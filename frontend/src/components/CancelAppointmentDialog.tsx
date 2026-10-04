import { useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { cancelAppointment, type UpcomingAppointment } from '../api/rescheduling';
import { formatDayTime } from '../utils/datetime';

type Props = { appointment: UpcomingAppointment; onClose: () => void; onCancelled: () => void };

export function CancelAppointmentDialog({ appointment, onClose, onCancelled }: Props) {
  const titleId = useId();
  const [who, setWho] = useState<'cancelada_paciente' | 'cancelada_clinica'>('cancelada_paciente');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelAppointment(appointment.appointmentId, who);
      onCancelled();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível cancelar a consulta.'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-sm rounded-xl bg-card p-5 shadow-lg">
        <h2 id={titleId} className="text-base font-bold">
          Cancelar consulta
        </h2>
        <p className="mt-1 text-sm text-muted">
          {appointment.patientName} · {formatDayTime(appointment.scheduledAt)} · {appointment.doctorName}
        </p>
        <fieldset className="mt-3 space-y-1.5 text-sm">
          <legend className="sr-only">Quem cancelou</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="who" checked={who === 'cancelada_paciente'} onChange={() => setWho('cancelada_paciente')} />
            Paciente cancelou
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="who" checked={who === 'cancelada_clinica'} onChange={() => setWho('cancelada_clinica')} />
            Clínica cancelou
          </label>
        </fieldset>
        <p className="mt-3 text-xs text-muted">
          {who === 'cancelada_paciente'
            ? 'O horário vira uma vaga e é oferecido a quem tem a consulta mais distante.'
            : 'O horário não é oferecido a outros pacientes, porque o médico pode não atender.'}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-alert-text">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button ref={backRef} type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-inner">
            Voltar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="rounded-lg bg-alert-text px-3 py-1.5 text-sm font-semibold text-white hover:bg-alert-text/90 disabled:opacity-50"
          >
            Cancelar consulta
          </button>
        </div>
      </div>
    </div>
  );
}