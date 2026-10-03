import { Router } from 'express';
import { createAppointmentSchema, updateStatusSchema } from './appointment.schemas.js';
import type { AppointmentService } from './appointment.service.js';
import { parseInput } from '../../utils/validate.js';


export function appointmentRoutes(service: AppointmentService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const input = parseInput(createAppointmentSchema, req.body);
    const appointment = await service.create(input);
    res.status(201).json(appointment);
  });

  router.patch('/:id/status', async (req, res) => {
    const { status } = parseInput(updateStatusSchema, req.body);
    const appointment = await service.changeStatus(req.params.id, status);
    res.json(appointment);
  });

  return router;
}