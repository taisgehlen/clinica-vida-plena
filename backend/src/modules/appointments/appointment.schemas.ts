import { z } from 'zod';

z.config(z.locales.pt());

export const createAppointmentSchema = z.object({
  patientId: z.string().trim().regex(/^PAC\d{4,}$/, 'patientId deve ter o formato PAC0001'),
  patientName: z.string().trim().min(2).max(120),
  patientPhone: z
    .string()
    .trim()
    .regex(/^\d{10,11}$/, 'telefone deve ter DDD + número, só dígitos (10 ou 11)')
    .nullable()
    .optional(),
  serviceType: z.enum(['convenio', 'particular']),
  doctorId: z.string().trim().regex(/^MED\d{2,}$/, 'doctorId deve ter o formato MED01'),
  scheduledAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});

export const updateStatusSchema = z.object({
  status: z.enum(['agendada', 'confirmada', 'realizada', 'falta', 'cancelada_paciente', 'cancelada_clinica']),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;