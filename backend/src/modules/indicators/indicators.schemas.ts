import { z } from 'zod';

z.config(z.locales.pt());

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, 'data inexistente');

export const indicatorsQuerySchema = z
  .object({ from: day.optional(), to: day.optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'a data inicial deve ser anterior ou igual à final',
    path: ['from'],
  });

export function periodBounds(q: { from?: string | undefined; to?: string | undefined }): { from: Date | null; to: Date | null } {  const toDate = (value: string, endOfDay: boolean) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  };
  return {
    from: q.from ? toDate(q.from, false) : null,
    to: q.to ? toDate(q.to, true) : null,
  };
}