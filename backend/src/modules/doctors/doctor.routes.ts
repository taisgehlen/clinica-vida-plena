import { Router } from 'express';
import type { DoctorRepository } from './doctor.types.js';

export function doctorRoutes(doctors: DoctorRepository): Router {
  const router = Router();

  // GET /api/doctors -> list with specialty and schedule (used by the frontend)
  router.get('/', async (_req, res) => {
    res.json(await doctors.findAll());
  });

  return router;
}