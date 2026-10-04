import type { ZodType } from 'zod';
import { HttpError } from './http-error.js';

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'entrada'}: ${issue.message}`)
      .join('; ');
    throw new HttpError(400, `Dados inválidos: ${details}`, 'validation_error');
  }
  return result.data;
}