import { useId, type ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function Card({ title, description, className = '', children }: Props) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`rounded-xl border border-line bg-card p-5 shadow-sm ${className}`}>
      <h2 id={titleId} className="text-sm font-bold text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      {children}
    </section>
  );
}