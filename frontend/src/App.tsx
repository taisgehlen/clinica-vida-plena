import { IndicatorsPage } from './pages/IndicatorsPage';

const PAGES = [{ id: 'indicators', label: 'Indicadores de falta' }];

export function App() {
  const current = 'indicators';

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="text-sm font-bold">Clínica Vida Plena</p>
          <nav aria-label="Principal">
            <ul className="flex gap-1">
              {PAGES.map((page) => (
                <li key={page.id}>
                  <span
                    aria-current={page.id === current ? 'page' : undefined}
                    className="block rounded-md px-3 py-1 text-sm font-semibold text-white/80 aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
                  >
                    {page.label}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {current === 'indicators' && <IndicatorsPage />}
    </div>
  );
}