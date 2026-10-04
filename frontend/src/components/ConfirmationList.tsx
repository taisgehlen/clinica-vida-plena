import { useState } from 'react';
import { errorMessage } from '../api/client';
import { confirmByPhone, getDoctors, getUpcoming, type UpcomingAppointment } from '../api/rescheduling';
import { useResource } from '../hooks/useResource';
import { daysLabel, formatDayTime, formatShortDate } from '../utils/datetime';
import { confirmationStatus } from '../utils/rescheduling';
import { CancelAppointmentDialog } from './CancelAppointmentDialog';
import { StatusPill } from './StatusPill';

type Props = { refreshKey: number; onChanged: () => void };
type Tab = 'attention' | 'all';

const PAGE_SIZE = 5;

const needsAttention = (row: UpcomingAppointment) =>
  row.confirmation?.status === 'pendente' || row.confirmation?.status === 'sem_resposta';

function ConfirmationText({ row }: { row: UpcomingAppointment }) {
  if (row.confirmation) {
    const { label, tone } = confirmationStatus(row.confirmation.status, row.confirmation.reminderSent);
    return <StatusPill tone={tone}>{label}</StatusPill>;
  }
  if (row.anticipated) return <StatusPill tone="good">Confirmada na antecipação</StatusPill>;
  if (row.status === 'confirmada') return <StatusPill tone="good">Confirmada</StatusPill>;
  if (!row.highRisk) return <span className="text-xs text-faint">Não precisa</span>;
  if (row.confirmationRequestDate) return <span className="text-xs text-faint">Pedido em {formatShortDate(row.confirmationRequestDate)}</span>;
  return <span className="text-xs text-faint">Sem telefone</span>;
}

function CancelLink({ row, onClick }: { row: UpcomingAppointment; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Cancelar consulta de ${row.patientName}`}
      className="text-xs font-semibold whitespace-nowrap text-alert-text hover:underline"
    >
      Cancelar
    </button>
  );
}

export function ConfirmationList({ refreshKey, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>('attention');
  const [doctorId, setDoctorId] = useState('');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState({ key: '', count: PAGE_SIZE });
  const [cancelling, setCancelling] = useState<UpcomingAppointment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const doctors = useResource('doctors', getDoctors);
  const upcoming = useResource(`${doctorId}|${search}|${refreshKey}`, (signal) => getUpcoming({ doctorId, search, situation: 'all' }, signal), 30_000);

  const all = upcoming.data ?? [];
  const attention = all
    .filter(needsAttention)
    .sort((a, b) => Number(b.confirmation?.status === 'sem_resposta') - Number(a.confirmation?.status === 'sem_resposta'));
  const rows = tab === 'attention' ? attention : all;

  const listKey = `${tab}|${doctorId}|${search}`;
  const limit = shown.key === listKey ? shown.count : PAGE_SIZE;
  const visible = rows.slice(0, limit);

  const handleConfirm = async (row: UpcomingAppointment) => {
    if (!row.confirmation) return;
    setActionError(null);
    try {
      await confirmByPhone(row.confirmation.id);
      onChanged();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível registrar a confirmação.'));
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attention', label: `Precisam de atenção (${attention.length})` },
    { id: 'all', label: `Todas as consultas (${all.length})` },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Consultas dos próximos 14 dias" className="flex border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-bold text-muted aria-selected:border-brand aria-selected:text-brand"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          aria-label="Filtrar por médico"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm"
        >
          <option value="">Todos os médicos</option>
          {doctors.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Buscar paciente"
          placeholder="Buscar paciente"
          value={search}
          maxLength={80}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm"
        />
      </div>

      {(upcoming.error || actionError) && (
        <p role="alert" className="mt-3 rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert-text">
          {actionError ?? upcoming.error}
        </p>
      )}

      <div role="tabpanel" className="mt-2" aria-busy={upcoming.loading}>
        {!upcoming.data && upcoming.loading && <p className="py-4 text-center text-sm text-muted">Carregando consultas…</p>}
        {upcoming.data && rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">
            {tab === 'attention' ? 'Nenhuma consulta esperando confirmação. Tudo em dia!' : 'Nenhuma consulta encontrada.'}
          </p>
        )}

        {tab === 'attention' ? (
          <ul>
            {visible.map((row) => (
              <li key={row.appointmentId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2.5 last:border-0">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-bold">{row.patientName}</p>
                  <p className="text-xs text-faint">
                    {formatDayTime(row.scheduledAt)} · {row.doctorName} · marcada com {daysLabel(row.leadDays)} de antecedência
                  </p>
                </div>
                <ConfirmationText row={row} />
                <button
                  type="button"
                  onClick={() => handleConfirm(row)}
                  aria-label={`Confirmou por telefone: ${row.patientName}`}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-inner"
                >
                  ✓ Confirmou presença
                </button>
                <CancelLink row={row} onClick={() => setCancelling(row)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th scope="col" className="py-2 pr-3 font-semibold">Quando</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Paciente</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Médico</th>
                  <th scope="col" className="py-2 pr-3 font-semibold" title="Dias entre marcar e a consulta. 15 dias ou mais é o grupo que mais falta.">
                    Antecedência
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Confirmação</th>
                  <th scope="col" className="py-2 font-semibold">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.appointmentId} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDayTime(row.scheduledAt)}</td>
                    <td className="py-2 pr-3">{row.patientName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{row.doctorName}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${row.highRisk ? 'font-bold text-alert-text' : ''}`}>
                      {daysLabel(row.leadDays)}
                      {row.highRisk && <span className="sr-only"> (risco alto de falta)</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <ConfirmationText row={row} />
                    </td>
                    <td className="py-2">
                      <CancelLink row={row} onClick={() => setCancelling(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > limit && (
          <button
            type="button"
            onClick={() => setShown({ key: listKey, count: limit + PAGE_SIZE })}
            className="mt-3 block w-full rounded-lg py-2 text-center text-[13px] font-bold text-brand hover:bg-inner"
          >
            Mostrar mais {Math.min(PAGE_SIZE, rows.length - limit)} ↓
          </button>
        )}
      </div>

      {cancelling && (
        <CancelAppointmentDialog
          appointment={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setCancelling(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
