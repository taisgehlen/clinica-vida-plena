import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { answerConfirmation, getConversation, type ConfirmationAnswer, type Contact } from '../api/rescheduling';
import { useResource } from '../hooks/useResource';
import { formatTime } from '../utils/datetime';
import { WhatsAppText } from './WhatsAppText';

type Props = { contact: Contact; refreshKey: number; onClose: () => void; onChanged: () => void };

export function ConversationDrawer({ contact, refreshKey, onClose, onChanged }: Props) {
  const conversation = useResource(`${contact.patientId}|${refreshKey}`, (signal) => getConversation(contact.patientId, signal), 10_000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const messageCount = conversation.data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messageCount]);

  const reply = async (token: string, answer: ConfirmationAnswer) => {
    setBusy(true);
    setError(null);
    try {
      await answerConfirmation(token, answer);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível enviar a resposta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Conversa simulada com ${contact.patientName}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-[#efe7de] shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
          <div>
            <p className="text-sm font-bold">{contact.patientName}</p>
            <p className="text-xs text-faint">{contact.phone} · WhatsApp simulado</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-inner">
            Fechar ✕
          </button>
        </div>

        <p className="bg-warn-bg px-4 py-2 text-xs font-semibold text-warn-text">
          Demonstração: em produção, só o paciente vê e responde estas mensagens no WhatsApp dele.
        </p>
        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
          {conversation.error && (
            <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert-text">
              {conversation.error}
            </p>
          )}
          {!conversation.data && conversation.loading && <p className="text-center text-sm text-muted">Carregando conversa…</p>}
          {conversation.data?.messages.map((message) => {
            const fromPatient = message.direction === 'in';
            const token = message.replyToken;
            return (
              <div
                key={message.id}
                className={`max-w-[88%] overflow-hidden rounded-xl text-sm leading-snug shadow-sm ${
                  fromPatient ? 'ml-auto rounded-tr-sm bg-[#d9fdd3]' : 'rounded-tl-sm bg-white'
                }`}
              >
                <div className="px-3 pt-2 pb-1.5">
                  <WhatsAppText text={message.body} />
                  <p className="mt-1 text-right text-[11px] text-[#667781]">
                    {formatTime(message.sentAt)}
                    {fromPatient && ' ✓✓'}
                  </p>
                </div>
                {message.link && (
                  <a
                    href={message.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-t border-[#e9edef] px-3 py-2.5 text-center font-semibold text-[#0b7bd0] hover:bg-[#f6f8fa]"
                  >
                    ↗ Ver horário e confirmar
                  </a>
                )}
                {token &&
                  message.buttons.map((button) => (
                    <button
                      key={button.answer}
                      type="button"
                      disabled={busy}
                      onClick={() => reply(token, button.answer)}
                      className="block w-full border-t border-[#e9edef] px-3 py-2.5 text-center font-semibold text-[#0b7bd0] hover:bg-[#f6f8fa] disabled:opacity-50"
                    >
                      {button.label}
                    </button>
                  ))}
              </div>
            );
          })}
          {error && (
            <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert-text">
              {error}
            </p>
          )}
          <div ref={endRef} />
        </div>
        <p className="px-4 pt-1 pb-3 text-center text-xs text-[#54656f]">Os botões simulam o que o paciente tocaria no WhatsApp.</p>
      </aside>
    </div>
  );
}
