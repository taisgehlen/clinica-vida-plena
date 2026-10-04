import { useId, type ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Card({ title, description, badge, className = '', children }: Props) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`rounded-xl border border-line bg-card p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="text-sm font-bold text-ink">
          {title}
        </h2>
        {badge}
      </div>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      {children}
    </section>
  );
}