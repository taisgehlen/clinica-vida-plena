import { useState } from 'react';
import { getOverview, type Contact } from '../api/rescheduling';
import { ConfirmationList } from '../components/ConfirmationList';
import { ContactsCard } from '../components/ContactsCard';
import { ConversationDrawer } from '../components/ConversationDrawer';
import { FlowSection } from '../components/FlowSection';
import { VacancyList } from '../components/VacancyList';
import { useResource } from '../hooks/useResource';

export function ReschedulingPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [openContact, setOpenContact] = useState<Contact | null>(null);
  const overview = useResource('overview', getOverview, 15_000);
  const refresh = () => {
    setRefreshKey((n) => n + 1);
    overview.reload();
  };
  const data = overview.data;
  const summary = data?.summary;

  return (
    <>
      <div className="border-b border-line bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold">Confirmações e vagas</h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhamento das confirmações de presença e do reaproveitamento de horários cancelados.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6">
        {overview.error && (
          <div role="alert" className="mb-4 rounded-lg border border-alert/40 bg-alert-soft px-4 py-3 text-sm">
            <p className="font-semibold">Não foi possível carregar as confirmações e vagas.</p>
            <p className="mt-0.5">{overview.error}</p>
            <button type="button" onClick={overview.reload} className="mt-2 font-semibold text-alert-text underline underline-offset-2">
              Tentar novamente
            </button>
          </div>
        )}

        {!data && overview.loading && <p className="text-sm text-muted">Carregando…</p>}

        {data && summary && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <FlowSection
                step={1}
                tone="brand"
                title="Confirmação de presença"
                description="Consultas agendadas com 15 dias ou mais de antecedência recebem solicitação de confirmação via WhatsApp. Sem resposta, o contato é feito pela recepção."
                rules={[
                  { label: 'Solicitação', value: '2 dias antes da consulta' },
                  { label: 'Lembrete', value: '24 horas antes, se não houver resposta' },
                  { label: 'Contato telefônico', value: 'A partir de 12 horas antes' },
                  { label: 'Cancelamento', value: 'Somente após confirmação do paciente' },
                ]}
                tiles={[
                  {
                    label: 'Aguardando resposta',
                    value: summary.awaitingConfirmation + summary.noAnswer,
                    note: summary.noAnswer > 0 ? `${summary.noAnswer} sem resposta: ligar` : 'pedidos enviados',
                    alert: summary.noAnswer > 0,
                  },
                  { label: 'Presenças confirmadas', value: summary.confirmed, note: 'nos últimos 7 dias' },
                  { label: 'Avisaram que não vêm', value: summary.declined, note: 'viraram vagas ↓' },
                ]}
              >
                <ConfirmationList refreshKey={refreshKey} onChanged={refresh} />
              </FlowSection>

              <FlowSection
                step={2}
                tone="teal"
                title="Antecipação de consultas"
                description="Horários liberados por cancelamento são oferecidos automaticamente ao paciente com a consulta mais distante com o mesmo médico."
                rules={[
                  { label: 'Ordem da fila', value: 'Consulta mais distante; no empate, agendamento mais antigo' },
                  { label: 'Antecipação mínima', value: '24 horas' },
                  { label: 'Prazo de resposta', value: '2 horas; depois, o convite segue para o próximo' },
                  { label: 'Limite', value: 'Horários a menos de 3 horas não são oferecidos' },
                ]}
                tiles={[
                  { label: 'Vagas em aberto', value: summary.openVacancies, note: 'esperando resposta' },
                  { label: 'Consultas antecipadas', value: summary.anticipatedThisMonth, note: 'neste mês' },
                  { label: 'Dias ganhos', value: summary.daysGainedThisMonth, note: 'somando os pacientes, neste mês' },
                ]}
              >
                <VacancyList vacancies={data.vacancies} onChanged={refresh} />
              </FlowSection>
            </div>
            <ContactsCard
              contacts={data.contacts}
              onOpenConversation={setOpenContact}
              className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            />
          </div>
        )}
      </main>

      {openContact && (
        <ConversationDrawer contact={openContact} refreshKey={refreshKey} onClose={() => setOpenContact(null)} onChanged={refresh} />
      )}
    </>
  );
}