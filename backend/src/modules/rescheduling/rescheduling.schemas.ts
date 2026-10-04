import { z } from 'zod';

const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'link inválido');

export const tokenParamsSchema = z.object({ token });

export const idParamsSchema = z.object({ id: z.string().trim().min(1).max(64) });

export const patientParamsSchema = z.object({ patientId: z.string().trim().regex(/^PAC\d{4,}$/, 'patientId deve ter o formato PAC0001') });

export const confirmationAnswerSchema = z.object({ answer: z.enum(['yes', 'no', 'cancel', 'keep']) });

export const upcomingQuerySchema = z.object({
  doctorId: z.string().trim().regex(/^MED\d{2,}$/).optional(),
  search: z.string().trim().max(80).optional(),
  situation: z.enum(['all', 'waiting', 'no_answer']).default('all'),
});
