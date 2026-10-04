import { useState } from 'react';
import type { Indicators } from '../api/indicators';
import { formatNumber } from '../utils/format';
import { Card } from './Card';

type Props = { patients: Indicators['repeatNoShowPatients']; className?: string };

const PREVIEW = 5;

export function RepeatPatientsCard({ patients, className }: Props) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? patients : patients.slice(0, PREVIEW);

  return (
    <Card
      title="Pacientes com 3 faltas ou mais"
      description={`${formatNumber(patients.length)} ${patients.length === 1 ? 'paciente' : 'pacientes'} no período. Prioridade para a recepção confirmar presença.`}
      className={className}
    >
      {patients.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum paciente com 3 faltas ou mais neste período.</p>
      ) : (
        <>
          <div className={expanded ? 'mt-3 max-h-96 overflow-y-auto' : 'mt-3'}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-line text-left text-xs text-faint">
                  <th scope="col" className="py-2 font-semibold">Paciente</th>
                  <th scope="col" className="py-2 text-right font-semibold">Faltas</th>
                  <th scope="col" className="py-2 text-right font-semibold">Consultas</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.patientId} className="border-b border-line last:border-b-0">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right">
                      <span className="inline-block min-w-7 rounded-full bg-alert-soft px-2 text-center font-bold text-alert-text">{p.noShows}</span>
                    </td>
                    <td className="py-2 text-right">{p.appointments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {patients.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-3 text-sm font-semibold text-brand hover:underline"
            >
              {expanded ? 'Mostrar menos' : `Ver todos os ${formatNumber(patients.length)} →`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}