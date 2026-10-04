import { lazy, Suspense, useState } from 'react';

const IndicatorsPage = lazy(() => import('./pages/IndicatorsPage').then((m) => ({ default: m.IndicatorsPage })));
const ReschedulingPage = lazy(() => import('./pages/ReschedulingPage').then((m) => ({ default: m.ReschedulingPage })));
const AnticipationPage = lazy(() => import('./pages/AnticipationPage').then((m) => ({ default: m.AnticipationPage })));

const ANTICIPATION_PATH = /^\/antecipar\/([A-Za-z0-9_-]{43})\/?$/;

const PAGES = [
  { id: 'indicators', label: 'Indicadores de falta' },
  { id: 'rescheduling', label: 'Confirmações e vagas' },
] as const;

type PageId = (typeof PAGES)[number]['id'];

export function App() {
  const [current, setCurrent] = useState<PageId>('indicators');
  const token = ANTICIPATION_PATH.exec(window.location.pathname)?.[1];

  if (token) {
    return (
      <Suspense fallback={null}>
        <AnticipationPage token={token} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="text-sm font-bold">Clínica Vida Plena</p>
          <nav aria-label="Principal">
            <ul className="flex gap-1">
              {PAGES.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => setCurrent(page.id)}
                    aria-current={page.id === current ? 'page' : undefined}
                    className="block rounded-md px-3 py-1 text-sm font-semibold text-white/80 hover:text-white aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
                  >
                    {page.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <Suspense fallback={<p className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted sm:px-6">Carregando…</p>}>
        {current === 'indicators' && <IndicatorsPage />}
        {current === 'rescheduling' && <ReschedulingPage />}
      </Suspense>
    </div>
  );
}
