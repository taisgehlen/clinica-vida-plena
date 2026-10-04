import type { ReactNode } from 'react';
import type { Tone } from '../utils/rescheduling';

const TONES: Record<Tone, string> = {
  info: 'bg-brand-soft text-brand',
  good: 'bg-good/15 text-good-text',
  neutral: 'bg-inner text-muted',
  alert: 'bg-alert-soft text-alert-text',
  warn: 'bg-warn-bg text-warn-text',
  teal: 'bg-teal-soft text-teal',
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}
