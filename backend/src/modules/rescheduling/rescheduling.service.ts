import { HttpError } from '../../utils/http-error.js';
import type { AppointmentService } from '../appointments/appointment.service.js';
import type { Appointment, AppointmentRepository } from '../appointments/appointment.types.js';
import { validateTransition } from '../appointments/rules/status.js';
import type { Doctor, DoctorRepository } from '../doctors/doctor.types.js';
import * as messages from './messages.js';
import type {
  Confirmation,
  ConfirmationAnswer,
  ConfirmationRepository,
  MessageKind,
  Offer,
  OfferRepository,
  Outbox,
  Vacancy,
  VacancyOrigin,
  VacancyRepository,
} from './rescheduling.types.js';
import { needsConfirmation, nextConfirmationStep } from './rules/confirmation.js';
import { buildQueue, canOffer, nextInQueue, offerExpiresAt } from './rules/queue.js';
import { createToken, hashToken } from './token.js';

export type ReschedulingDependencies = {
  appointments: AppointmentRepository;
  doctors: DoctorRepository;
  appointmentService: AppointmentService;
  confirmations: ConfirmationRepository;
  vacancies: VacancyRepository;
  offers: OfferRepository;
  outbox: Outbox;
  now: () => Date;
  offerTtlMinutes: number;
  publicUrl: string;
};

const DAY = 24 * 60 * 60 * 1000;

export type OfferView = {
  status: Offer['status'];
  patientFirstName: string;
  doctorName: string;
  specialty: string;
  newScheduledAt: Date;
  currentScheduledAt: Date;
  expiresAt: Date;
  gainDays: number;
};

export class ReschedulingService {
  constructor(private readonly deps: ReschedulingDependencies) {}

  private get now(): Date {
    return this.deps.now();
  }

  private async doctor(id: string): Promise<Doctor> {
    const doctor = await this.deps.doctors.findById(id);
    if (!doctor) throw new Error(`Doctor ${id} not found`);
    return doctor;
  }

  private async send(
    appointment: Appointment,
    kind: MessageKind,
    content: messages.MessageContent,
    refs: { confirmationId?: string; offerId?: string; link?: string; replyToken?: string } = {},
  ): Promise<void> {
    await this.deps.outbox.send({
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      phone: appointment.patientPhone ?? '',
      direction: 'out',
      kind,
      body: content.body,
      buttons: content.buttons,
      link: refs.link ?? null,
      replyToken: refs.replyToken ?? null,
      confirmationId: refs.confirmationId ?? null,
      offerId: refs.offerId ?? null,
      sentAt: this.now,
    });
  }

  private async patientReply(appointment: Appointment, text: string, confirmationId: string): Promise<void> {
    await this.deps.outbox.send({
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      phone: appointment.patientPhone ?? '',
      direction: 'in',
      kind: 'patient_reply',
      body: text,
      buttons: [],
      link: null,
      replyToken: null,
      confirmationId,
      offerId: null,
      sentAt: this.now,
    });
  }

  async tick(): Promise<void> {
    await this.sendDueConfirmations();
    await this.advanceConfirmations();
    await this.expireOffers();
  }

  private async sendDueConfirmations(): Promise<void> {
    const now = this.now;
    const due = (await this.deps.appointments.findActiveFrom(now)).filter((a) => needsConfirmation(a, now));
    if (due.length === 0) return;
    const existing = new Set(
      (await this.deps.confirmations.findByAppointmentIds(due.map((a) => a.id))).map((c) => c.appointmentId),
    );
    for (const appointment of due.filter((a) => !existing.has(a.id))) {
      const { token, tokenHash } = createToken();
      const confirmation = await this.deps.confirmations.create({
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        scheduledAt: appointment.scheduledAt,
        status: 'pendente',
        awaitingCancelAnswer: false,
        tokenHash,
        sentAt: now,
        reminderSentAt: null,
        answeredAt: null,
        events: [{ at: now, type: 'request_sent' }],
      });
      const doctor = await this.doctor(appointment.doctorId);
      await this.send(appointment, 'confirmation_request', messages.confirmationRequest(appointment.patientName, doctor, appointment.scheduledAt), {
        confirmationId: confirmation.id,
        replyToken: token,
      });
    }
  }

  private async advanceConfirmations(): Promise<void> {
    const now = this.now;
    for (const confirmation of await this.deps.confirmations.findPending()) {
      if (confirmation.awaitingCancelAnswer) continue;
      const step = nextConfirmationStep(confirmation, now);
      if (step === 'mark_no_answer') {
        await this.deps.confirmations.update(confirmation.id, { status: 'sem_resposta' }, { at: now, type: 'no_answer' });
      } else if (step === 'send_reminder') {
        const appointment = await this.deps.appointments.findById(confirmation.appointmentId);
        if (!appointment) continue;
        await this.deps.confirmations.update(confirmation.id, { reminderSentAt: now }, { at: now, type: 'reminder_sent' });
        const doctor = await this.doctor(appointment.doctorId);
        const history = await this.deps.outbox.findByPatient(appointment.patientId);
        const token = history.find((m) => m.confirmationId === confirmation.id && m.replyToken)?.replyToken;
        await this.send(appointment, 'confirmation_reminder', messages.confirmationReminder(appointment.patientName, doctor, appointment.scheduledAt), {
          confirmationId: confirmation.id,
          ...(token ? { replyToken: token } : {}),
        });
      }
    }
  }

  private async expireOffers(): Promise<void> {
    const now = this.now;
    for (const offer of await this.deps.offers.findPending()) {
      if (offer.expiresAt.getTime() > now.getTime()) continue;
      const closed = await this.deps.offers.closeIfPending(offer.id, 'expirada', now);
      if (!closed) continue;
      const [appointment, vacancy] = await Promise.all([
        this.deps.appointments.findById(offer.appointmentId),
        this.deps.vacancies.findById(offer.vacancyId),
      ]);
      if (appointment && vacancy) {
        await this.send(appointment, 'offer_expired', messages.offerExpired(appointment.patientName, vacancy.scheduledAt, appointment.scheduledAt), {
          offerId: offer.id,
        });
      }
      await this.reopen(offer.vacancyId);
    }
  }

  async handleCancellation(appointment: Appointment): Promise<void> {
    const now = this.now;
    const [confirmation] = await this.deps.confirmations.findByAppointmentIds([appointment.id]);
    if (confirmation && (confirmation.status === 'pendente' || confirmation.status === 'sem_resposta')) {
      await this.deps.confirmations.update(
        confirmation.id,
        { status: 'cancelou', awaitingCancelAnswer: false, answeredAt: now },
        { at: now, type: 'cancelled_by_reception' },
      );
    }
    for (const offer of (await this.deps.offers.findPending()).filter((o) => o.appointmentId === appointment.id)) {
      if (await this.deps.offers.closeIfPending(offer.id, 'cancelada', now)) await this.reopen(offer.vacancyId);
    }
    await this.openVacancy(appointment.doctorId, appointment.scheduledAt, {
      kind: 'cancelamento',
      appointmentId: appointment.id,
      patientName: appointment.patientName,
    });
  }

  private async openVacancy(doctorId: string, scheduledAt: Date, origin: VacancyOrigin): Promise<void> {
    const now = this.now;
    if (scheduledAt.getTime() <= now.getTime()) return;
    const vacancy = await this.deps.vacancies.create({
      doctorId,
      scheduledAt,
      status: canOffer(scheduledAt, now) ? 'aberta' : 'em_cima_da_hora',
      origin,
      filledByAppointmentId: null,
      createdAt: now,
    });
    if (vacancy.status === 'aberta') await this.offerNext(vacancy);
  }

  private async reopen(vacancyId: string): Promise<void> {
    const vacancy = await this.deps.vacancies.changeStatus(vacancyId, ['oferecida'], 'aberta');
    if (vacancy) await this.offerNext(vacancy);
  }

  async queueFor(vacancy: Vacancy) {
    const [appointments, offersOfVacancy, pending] = await Promise.all([
      this.deps.appointments.findActiveFrom(vacancy.scheduledAt),
      this.deps.offers.findByVacancy(vacancy.id),
      this.deps.offers.findPending(),
    ]);
    return buildQueue(vacancy, appointments, {
      alreadyOffered: new Set(offersOfVacancy.map((o) => o.appointmentId)),
      patientsWithOpenOffer: new Set(pending.map((o) => o.patientId)),
    });
  }

  private async offerNext(vacancy: Vacancy): Promise<void> {
    const now = this.now;
    if (!canOffer(vacancy.scheduledAt, now)) {
      await this.deps.vacancies.changeStatus(vacancy.id, ['aberta'], 'em_cima_da_hora');
      return;
    }
    const next = nextInQueue(await this.queueFor(vacancy));
    if (!next) {
      await this.deps.vacancies.changeStatus(vacancy.id, ['aberta'], 'sem_fila');
      return;
    }
    const claimed = await this.deps.vacancies.changeStatus(vacancy.id, ['aberta'], 'oferecida');
    if (!claimed) return;

    const appointment = next;
    const { token, tokenHash } = createToken();
    const expiresAt = offerExpiresAt(now, vacancy.scheduledAt, this.deps.offerTtlMinutes);
    const offer = await this.deps.offers.create({
      vacancyId: vacancy.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      previousScheduledAt: appointment.scheduledAt,
      status: 'pendente',
      tokenHash,
      sentAt: now,
      expiresAt,
      answeredAt: null,
    });
    const doctor = await this.doctor(vacancy.doctorId);
    await this.send(
      appointment,
      'offer',
      messages.offerMessage(appointment.patientName, doctor, vacancy.scheduledAt, appointment.scheduledAt, expiresAt),
      { offerId: offer.id, link: `${this.deps.publicUrl}/antecipar/${token}` },
    );
  }

  async answerConfirmation(token: string, answer: ConfirmationAnswer): Promise<Confirmation> {
    const now = this.now;
    const confirmation = await this.deps.confirmations.findByTokenHash(hashToken(token));
    if (!confirmation) throw new HttpError(404, 'Confirmação não encontrada', 'confirmation_not_found');
    if (confirmation.status !== 'pendente' && confirmation.status !== 'sem_resposta') {
      throw new HttpError(409, 'Esta confirmação já foi respondida', 'confirmation_closed');
    }
    const expectsCancelAnswer = answer === 'cancel' || answer === 'keep';
    if (expectsCancelAnswer !== confirmation.awaitingCancelAnswer) {
      throw new HttpError(409, 'Resposta não esperada neste momento da conversa', 'unexpected_answer');
    }
    const appointment = await this.deps.appointments.findById(confirmation.appointmentId);
    if (!appointment) throw new HttpError(404, 'Consulta não encontrada', 'appointment_not_found');
    const doctor = await this.doctor(appointment.doctorId);

    const labels: Record<ConfirmationAnswer, string> = {
      yes: 'Vou comparecer',
      no: 'Não poderei ir',
      cancel: 'Sim, cancelar consulta',
      keep: 'Não, vou manter',
    };
    await this.patientReply(appointment, labels[answer], confirmation.id);

    if (answer === 'no') {
      const updated = await this.deps.confirmations.update(confirmation.id, { awaitingCancelAnswer: true }, { at: now, type: 'said_cannot_go' });
      await this.send(appointment, 'confirmation_ask_cancel', messages.confirmationAskCancel(appointment.patientName, appointment.scheduledAt), {
        confirmationId: confirmation.id,
        replyToken: token,
      });
      return updated;
    }

    if (answer === 'cancel') {
      const check = validateTransition(appointment.status, 'cancelada_paciente', appointment.scheduledAt, now);
      if (!check.ok) throw new HttpError(422, check.error, 'invalid_transition');
      const updated = await this.deps.confirmations.update(
        confirmation.id,
        { status: 'cancelou', awaitingCancelAnswer: false, answeredAt: now },
        { at: now, type: 'cancelled_by_patient' },
      );
      await this.send(appointment, 'confirmation_cancelled', messages.confirmationCancelled(appointment.patientName), {
        confirmationId: confirmation.id,
      });
      await this.deps.appointmentService.changeStatus(appointment.id, 'cancelada_paciente');
      return updated;
    }

    if (appointment.status === 'agendada') await this.deps.appointmentService.changeStatus(appointment.id, 'confirmada');
    const updated = await this.deps.confirmations.update(
      confirmation.id,
      { status: 'confirmada', awaitingCancelAnswer: false, answeredAt: now },
      { at: now, type: answer === 'keep' ? 'kept_appointment' : 'confirmed' },
    );
    await this.send(appointment, 'confirmation_confirmed', messages.confirmationConfirmed(doctor, appointment.scheduledAt), {
      confirmationId: confirmation.id,
    });
    return updated;
  }

  async confirmByPhone(confirmationId: string): Promise<Confirmation> {
    const confirmation = await this.deps.confirmations.findById(confirmationId);
    if (!confirmation) throw new HttpError(404, 'Confirmação não encontrada', 'confirmation_not_found');
    if (confirmation.status !== 'pendente' && confirmation.status !== 'sem_resposta') {
      throw new HttpError(409, 'Esta confirmação já foi respondida', 'confirmation_closed');
    }
    const appointment = await this.deps.appointments.findById(confirmation.appointmentId);
    if (appointment?.status === 'agendada') await this.deps.appointmentService.changeStatus(appointment.id, 'confirmada');
    const now = this.now;
    return this.deps.confirmations.update(
      confirmation.id,
      { status: 'confirmada', awaitingCancelAnswer: false, answeredAt: now },
      { at: now, type: 'confirmed_by_phone' },
    );
  }

  private async offerByToken(token: string): Promise<Offer> {
    const offer = await this.deps.offers.findByTokenHash(hashToken(token));
    if (!offer) throw new HttpError(404, 'Oferta não encontrada', 'offer_not_found');
    return offer;
  }

  async viewOffer(token: string): Promise<OfferView> {
    const offer = await this.offerByToken(token);
    const [appointment, vacancy] = await Promise.all([
      this.deps.appointments.findById(offer.appointmentId),
      this.deps.vacancies.findById(offer.vacancyId),
    ]);
    if (!appointment || !vacancy) throw new HttpError(404, 'Oferta não encontrada', 'offer_not_found');
    const doctor = await this.doctor(vacancy.doctorId);
    const expired = offer.status === 'pendente' && offer.expiresAt.getTime() <= this.now.getTime();
    return {
      status: expired ? 'expirada' : offer.status,
      patientFirstName: messages.firstName(appointment.patientName),
      doctorName: doctor.name,
      specialty: doctor.specialty,
      newScheduledAt: vacancy.scheduledAt,
      currentScheduledAt: offer.previousScheduledAt,
      expiresAt: offer.expiresAt,
      gainDays: Math.max(1, Math.round((offer.previousScheduledAt.getTime() - vacancy.scheduledAt.getTime()) / DAY)),
    };
  }

  async acceptOffer(token: string): Promise<OfferView> {
    const now = this.now;
    const offer = await this.offerByToken(token);
    if (offer.status !== 'pendente') throw new HttpError(409, 'Esta oferta já foi respondida', 'offer_closed');
    if (offer.expiresAt.getTime() <= now.getTime()) throw new HttpError(410, 'O prazo desta oferta terminou', 'offer_expired');

    const [appointment, vacancy] = await Promise.all([
      this.deps.appointments.findById(offer.appointmentId),
      this.deps.vacancies.findById(offer.vacancyId),
    ]);
    if (!appointment || !vacancy || (appointment.status !== 'agendada' && appointment.status !== 'confirmada')) {
      throw new HttpError(409, 'Esta oferta não está mais disponível', 'offer_unavailable');
    }
    const [doctorBusy, patientBusy] = await Promise.all([
      this.deps.appointments.findActiveByDoctorAt(vacancy.doctorId, vacancy.scheduledAt),
      this.deps.appointments.findActiveByPatientAt(appointment.patientId, vacancy.scheduledAt),
    ]);
    if (doctorBusy || patientBusy) throw new HttpError(409, 'Este horário não está mais disponível', 'slot_taken');

    const accepted = await this.deps.offers.closeIfPending(offer.id, 'aceita', now);
    if (!accepted) throw new HttpError(409, 'Esta oferta já foi respondida', 'offer_closed');

    const moved = await this.deps.appointments.reschedule(appointment.id, vacancy.scheduledAt, 'confirmada');
    await this.deps.vacancies.changeStatus(vacancy.id, ['oferecida'], 'preenchida', appointment.id);

    const [confirmation] = await this.deps.confirmations.findByAppointmentIds([appointment.id]);
    if (confirmation && (confirmation.status === 'pendente' || confirmation.status === 'sem_resposta')) {
      await this.deps.confirmations.update(confirmation.id, { status: 'confirmada', awaitingCancelAnswer: false, answeredAt: now }, { at: now, type: 'confirmed' });
    }

    const doctor = await this.doctor(vacancy.doctorId);
    await this.send(moved, 'offer_accepted', messages.offerAccepted(moved.patientName, doctor, moved.scheduledAt), { offerId: offer.id });
    await this.openVacancy(appointment.doctorId, offer.previousScheduledAt, {
      kind: 'antecipacao',
      appointmentId: appointment.id,
      patientName: appointment.patientName,
    });
    return this.viewOffer(token);
  }

  async declineOffer(token: string): Promise<OfferView> {
    const offer = await this.offerByToken(token);
    const closed = await this.deps.offers.closeIfPending(offer.id, 'recusada', this.now);
    if (!closed) throw new HttpError(409, 'Esta oferta já foi respondida', 'offer_closed');
    const appointment = await this.deps.appointments.findById(offer.appointmentId);
    if (appointment) {
      await this.send(appointment, 'offer_kept', messages.offerKept(appointment.patientName, appointment.scheduledAt), { offerId: offer.id });
    }
    await this.reopen(offer.vacancyId);
    return this.viewOffer(token);
  }

  async cancelOffer(offerId: string): Promise<void> {
    const closed = await this.deps.offers.closeIfPending(offerId, 'cancelada', this.now);
    if (!closed) throw new HttpError(409, 'Esta oferta não está mais pendente', 'offer_closed');
    await this.reopen(closed.vacancyId);
  }
}
