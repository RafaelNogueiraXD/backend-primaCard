import { Router } from 'express';
import { SurveyController } from './survey.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();
const surveyController = new SurveyController();

// Public routes (authenticated users)
router.get('/available', authenticate, surveyController.getAvailable.bind(surveyController));
router.get('/my-responses', authenticate, surveyController.getMyResponses.bind(surveyController));
router.post('/:surveyId/responses', authenticate, surveyController.submitResponse.bind(surveyController));

// Survey management routes (admin/professional only)
router.post('/', authenticate, authorize('ADMIN', 'PROFESSIONAL'), surveyController.create.bind(surveyController));
router.get('/', authenticate, authorize('ADMIN', 'PROFESSIONAL'), surveyController.list.bind(surveyController));
router.get('/:id', authenticate, surveyController.getById.bind(surveyController));
router.put('/:id', authenticate, authorize('ADMIN', 'PROFESSIONAL'), surveyController.update.bind(surveyController));
router.delete('/:id', authenticate, authorize('ADMIN', 'PROFESSIONAL'), surveyController.delete.bind(surveyController));

// Response management routes (admin/professional only)
router.get('/:id/responses', authenticate, authorize('ADMIN', 'PROFESSIONAL'), surveyController.getResponses.bind(surveyController));

export default router;
