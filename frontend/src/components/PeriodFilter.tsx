import { useState } from 'react';
import type { Period } from '../api/indicators';
import { presetPeriod } from '../utils/period';

type Preset = { id: string; label: string; months: number | null };
const PRESETS: Preset[] = [
  { id: 'all', label: 'Todo o histórico', months: null },
  { id: '12m', label: 'Últimos 12 meses', months: 12 },
  { id: '3m', label: 'Últimos 3 meses', months: 3 },
];

type Props = { value: Period; onChange: (period: Period) => void };

export function PeriodFilter({ value, onChange }: Props) {
  const [draft, setDraft] = useState<Period>(value);
  const [activePreset, setActivePreset] = useState<string | null>('all');
  const invalid = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  const isCleared = activePreset === 'all' && draft.from === '' && draft.to === '';

  const choosePreset = (preset: Preset) => {
    const period = presetPeriod(preset.months);
    setActivePreset(preset.id);
    setDraft(period);
    onChange(period);
  };

  const clear = () => {
    const period = presetPeriod(null);
    setActivePreset('all');
    setDraft(period);
    onChange(period);
  };

  const inputClass = 'rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink';

  return (
    <form
      aria-label="Filtro de período"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid) return;
        setActivePreset(null);
        onChange(draft);
      }}
    >
      <div role="group" aria-label="Períodos prontos" className="flex w-full rounded-lg bg-inner p-1 sm:w-auto">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => choosePreset(preset)}
            aria-pressed={activePreset === preset.id}
            className="flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-semibold sm:flex-none sm:px-3 sm:text-sm text-muted hover:text-ink aria-pressed:bg-card aria-pressed:text-brand aria-pressed:shadow-sm"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          De
          <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Até
          <input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={invalid}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Aplicar período
        </button>
        {!isCleared && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-inner hover:text-ink"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {invalid && (
        <p role="alert" className="w-full text-sm text-alert-text">
          A data inicial precisa ser anterior ou igual à data final.
        </p>
      )}
    </form>
  );
}