import { Router } from 'express';
import { parseInput } from '../../utils/validate.js';
import type { AppointmentRepository } from '../appointments/appointment.types.js';
import type { DoctorRepository } from '../doctors/doctor.types.js';
import { computeIndicators } from './indicators.calculator.js';
import { computeSchedule } from './schedule.calculator.js';
import { indicatorsQuerySchema, periodBounds } from './indicators.schemas.js';

export function indicatorRoutes(
  appointments: AppointmentRepository,
  doctors: DoctorRepository,
  now: () => Date = () => new Date(),
): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const query = parseInput(indicatorsQuerySchema, req.query);
    const { from, to } = periodBounds(query);
    const [all, doctorList] = await Promise.all([appointments.findAll(), doctors.findAll()]);
    const period = { from: query.from ?? null, to: query.to ?? null };
    res.json({
      ...computeIndicators(all, doctorList, from, to, period),
      schedule: computeSchedule(all, doctorList, from, to, now()),
    });
  });

  return router;
}