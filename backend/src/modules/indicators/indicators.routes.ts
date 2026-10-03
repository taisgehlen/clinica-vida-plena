import { Router } from 'express';
import { parseInput } from '../../utils/validate.js';
import type { AppointmentRepository } from '../appointments/appointment.types.js';
import type { DoctorRepository } from '../doctors/doctor.types.js';
import { computeIndicators } from './indicators.calculator.js';
import { indicatorsQuerySchema, periodBounds } from './indicators.schemas.js';

export function indicatorRoutes(appointments: AppointmentRepository, doctors: DoctorRepository): Router {
  const router = Router();

  // GET /api/indicators?from=2026-01-01&to=2026-06-30 (both optional)
  router.get('/', async (req, res) => {
    const query = parseInput(indicatorsQuerySchema, req.query);
    const { from, to } = periodBounds(query);
    // The whole history is loaded because first visits and reused slots depend on it.
    // ~7k appointments fit easily in memory; a much larger clinic would need
    // these numbers pre-aggregated in the database instead.
    const [all, doctorList] = await Promise.all([appointments.findAll(), doctors.findAll()]);
    res.json(computeIndicators(all, doctorList, from, to, { from: query.from ?? null, to: query.to ?? null }));
  });

  return router;
}