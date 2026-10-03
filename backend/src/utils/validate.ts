import type { ZodType } from 'zod';
import { HttpError } from './http-error.js';

// Validates any external input (body, query string) with a Zod schema.
// Invalid input becomes a 400 that lists every problem found.
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