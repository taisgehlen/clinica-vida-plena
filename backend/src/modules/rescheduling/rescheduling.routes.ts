import { Router } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { parseInput } from '../../utils/validate.js';
import type { ReschedulingService } from './rescheduling.service.js';
import type { ReschedulingViews } from './rescheduling.views.js';
import {
  confirmationAnswerSchema,
  idParamsSchema,
  patientParamsSchema,
  tokenParamsSchema,
  upcomingQuerySchema,
} from './rescheduling.schemas.js';

export function receptionRoutes(service: ReschedulingService, views: ReschedulingViews): Router {
  const router = Router();

  router.get('/overview', async (_req, res) => {
    res.json(await views.overview());
  });

  router.get('/upcoming', async (req, res) => {
    const query = parseInput(upcomingQuerySchema, req.query);
    res.json(await views.upcoming({ doctorId: query.doctorId, search: query.search, situation: query.situation }));
  });

  router.get('/conversations/:patientId', async (req, res) => {
    const { patientId } = parseInput(patientParamsSchema, req.params);
    const conversation = await views.conversation(patientId);
    if (!conversation) throw new HttpError(404, 'Nenhuma mensagem para este paciente', 'conversation_not_found');
    res.json(conversation);
  });

  router.post('/confirmations/:id/confirm-by-phone', async (req, res) => {
    const { id } = parseInput(idParamsSchema, req.params);
    res.json(await service.confirmByPhone(id));
  });

  router.post('/offers/:id/cancel', async (req, res) => {
    const { id } = parseInput(idParamsSchema, req.params);
    await service.cancelOffer(id);
    res.status(204).end();
  });

  return router;
}

export function patientRoutes(service: ReschedulingService): Router {
  const router = Router();

  router.post('/confirmations/:token', async (req, res) => {
    const { token } = parseInput(tokenParamsSchema, req.params);
    const { answer } = parseInput(confirmationAnswerSchema, req.body);
    const confirmation = await service.answerConfirmation(token, answer);
    res.json({ status: confirmation.status, awaitingCancelAnswer: confirmation.awaitingCancelAnswer });
  });

  router.get('/offers/:token', async (req, res) => {
    const { token } = parseInput(tokenParamsSchema, req.params);
    res.json(await service.viewOffer(token));
  });

  router.post('/offers/:token/accept', async (req, res) => {
    const { token } = parseInput(tokenParamsSchema, req.params);
    res.json(await service.acceptOffer(token));
  });

  router.post('/offers/:token/decline', async (req, res) => {
    const { token } = parseInput(tokenParamsSchema, req.params);
    res.json(await service.declineOffer(token));
  });

  return router;
}
