import { useId, useState, type ReactNode } from 'react';

export type Tile = { label: string; value: number; note: string; alert?: boolean };

export type Rule = { label: string; value: string };

type Props = {
  step: number;
  title: string;
  tone: 'brand' | 'teal';
  description: string;
  rules: Rule[];
  tiles: Tile[];
  children: ReactNode;
};

const TONES = {
  brand: { border: 'border-t-brand', badge: 'bg-brand-soft text-brand', link: 'text-brand' },
  teal: { border: 'border-t-teal', badge: 'bg-teal-soft text-teal', link: 'text-teal' },
};

export function FlowSection({ step, title, tone, description, rules, tiles, children }: Props) {
  const titleId = useId();
  const rulesId = useId();
  const [showRules, setShowRules] = useState(false);
  const colors = TONES[tone];
  return (
    <section aria-labelledby={titleId} className={`rounded-xl border border-t-4 border-line bg-card p-5 shadow-sm ${colors.border}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`flex size-8 flex-none items-center justify-center rounded-lg text-base font-extrabold ${colors.badge}`}>
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-bold">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>
          <button
            type="button"
            aria-expanded={showRules}
            aria-controls={rulesId}
            onClick={() => setShowRules((open) => !open)}
            className={`mt-1.5 text-xs font-bold ${colors.link}`}
          >
            Como funciona <span aria-hidden="true">{showRules ? '▴' : '▾'}</span>
          </button>
          {showRules && (
            <dl id={rulesId} className="mt-2 overflow-hidden rounded-lg border border-line text-xs">
              {rules.map((rule) => (
                <div key={rule.label} className="grid grid-cols-[minmax(0,10rem)_1fr] border-t border-line first:border-t-0">
                  <dt className="bg-inner px-3 py-1.5 font-semibold text-muted">{rule.label}</dt>
                  <dd className="px-3 py-1.5">{rule.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <ul aria-label={`Números: ${title}`} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label} className="rounded-xl border border-line px-3.5 py-2.5">
            <p className="text-xs font-semibold text-muted">{tile.label}</p>
            <p className="text-2xl font-bold">{tile.value}</p>
            <p className={`text-xs ${tile.alert ? 'font-bold text-alert-text' : 'text-faint'}`}>{tile.note}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4">{children}</div>
    </section>
  );
}