import { Router } from 'express';
import type { DoctorRepository } from './doctor.types.js';

export function doctorRoutes(doctors: DoctorRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await doctors.findAll());
  });

  return router;
}