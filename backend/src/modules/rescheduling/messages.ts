import type { MessageButton } from './rescheduling.types.js';

const TIME_ZONE = 'America/Sao_Paulo';

const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TIME_ZONE });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE });

export function formatHour(date: Date): string {
  const [hours, minutes] = timeFormat.format(date).split(':');
  return minutes === '00' ? `${hours}h` : `${hours}h${minutes}`;
}

export function formatLong(date: Date): string {
  return `${weekdayFormat.format(date)}, ${dateFormat.format(date)}, às ${formatHour(date)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function withArticle(doctorName: string): string {
  return doctorName.startsWith('Dra.') ? `a ${doctorName}` : `o ${doctorName}`;
}

export type Doctorlike = { name: string; specialty: string };

export type MessageContent = { body: string; buttons: MessageButton[] };

const CONFIRM_BUTTONS: MessageButton[] = [
  { label: 'Vou comparecer', answer: 'yes' },
  { label: 'Não poderei ir', answer: 'no' },
];

const ARRIVAL_TIPS =
  'Chegue com 15 minutos de antecedência e traga um documento com foto e a carteirinha do convênio, se tiver.';

export function confirmationRequest(patientName: string, doctor: Doctorlike, scheduledAt: Date): MessageContent {
  return {
    body: [
      `Olá, ${firstName(patientName)}! Aqui é da *Clínica Vida Plena*.`,
      'Passando para lembrar da sua consulta:',
      `*${formatLong(scheduledAt)}*\n${doctor.name} · ${doctor.specialty}`,
      'Você pode confirmar sua presença? Se não puder vir, é só avisar por aqui: assim liberamos o horário para outro paciente que está aguardando.',
    ].join('\n\n'),
    buttons: CONFIRM_BUTTONS,
  };
}

export function confirmationReminder(patientName: string, doctor: Doctorlike, scheduledAt: Date): MessageContent {
  return {
    body: [
      `Olá, ${firstName(patientName)}! Ainda não recebemos a confirmação da sua consulta:`,
      `*${formatLong(scheduledAt)}*\n${doctor.name} · ${doctor.specialty}`,
      'Pode nos responder? Leva só um toque. Se não puder vir, avise por aqui para liberarmos o horário.',
    ].join('\n\n'),
    buttons: CONFIRM_BUTTONS,
  };
}

export function confirmationAskCancel(patientName: string, scheduledAt: Date): MessageContent {
  return {
    body: `Tudo bem, ${firstName(patientName)}, obrigado por avisar.\n\nQuer que a gente *cancele sua consulta* de ${formatLong(scheduledAt)}?`,
    buttons: [
      { label: 'Sim, cancelar consulta', answer: 'cancel' },
      { label: 'Não, vou manter', answer: 'keep' },
    ],
  };
}

export function confirmationConfirmed(doctor: Doctorlike, scheduledAt: Date): MessageContent {
  return {
    body: `Presença confirmada! ✅\n\nEsperamos você *${formatLong(scheduledAt)}* com ${withArticle(doctor.name)}.\n\n${ARRIVAL_TIPS}`,
    buttons: [],
  };
}

export function confirmationCancelled(patientName: string): MessageContent {
  return {
    body: `Pronto, ${firstName(patientName)}. Sua consulta foi cancelada.\n\nObrigado por avisar com antecedência: o horário vai ajudar outro paciente que está aguardando. Quando quiser remarcar, é só responder aqui.`,
    buttons: [],
  };
}

export function offerMessage(
  patientName: string,
  doctor: Doctorlike,
  vacancyAt: Date,
  currentAt: Date,
  expiresAt: Date,
): MessageContent {
  return {
    body: [
      `Olá, ${firstName(patientName)}! Aqui é da *Clínica Vida Plena*.`,
      `Temos uma boa notícia: abriu um horário com ${withArticle(doctor.name)} (${doctor.specialty}) antes da sua consulta, e você é a próxima pessoa da nossa lista de espera.`,
      `Novo horário: *${formatLong(vacancyAt)}*\nSua consulta atual: ${formatLong(currentAt)}`,
      `Se quiser antecipar, toque no link e confirme até as *${formatHour(expiresAt)}*.`,
      'Se preferir manter a data atual, não precisa fazer nada: sua consulta continua garantida.',
    ].join('\n\n'),
    buttons: [],
  };
}

export function offerAccepted(patientName: string, doctor: Doctorlike, scheduledAt: Date): MessageContent {
  return {
    body: `Pronto, ${firstName(patientName)}! Sua consulta foi antecipada. ✅\n\n*${formatLong(scheduledAt)}*\n${doctor.name} · ${doctor.specialty}\n\n${ARRIVAL_TIPS}`,
    buttons: [],
  };
}

export function offerKept(patientName: string, currentAt: Date): MessageContent {
  return {
    body: `Tudo certo, ${firstName(patientName)}. Mantivemos sua consulta de *${formatLong(currentAt)}*.\n\nSe abrir outro horário antes, avisamos você por aqui.`,
    buttons: [],
  };
}

export function offerExpired(patientName: string, vacancyAt: Date, currentAt: Date): MessageContent {
  return {
    body: `${firstName(patientName)}, o horário de ${formatLong(vacancyAt)} já foi oferecido a outro paciente da lista de espera.\n\nSua consulta de *${formatLong(currentAt)}* continua confirmada, sem nenhuma alteração.`,
    buttons: [],
  };
}
