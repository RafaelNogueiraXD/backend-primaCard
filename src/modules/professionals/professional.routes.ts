import { Router } from 'express';
import { body } from 'express-validator';
import { ProfessionalController } from './professional.controller';
import { validate } from '../../middleware/validation';
import { authenticate } from '../../middleware/auth';

const router = Router();
const professionalController = new ProfessionalController();

/**
 * @swagger
 * /professionals:
 *   get:
 *     summary: List all professionals
 *     tags: [Professionals]
 *     parameters:
 *       - in: query
 *         name: specialty
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of professionals
 */
router.get('/', professionalController.list.bind(professionalController));

/**
 * @swagger
 * /professionals/statistics:
 *   get:
 *     summary: Get professional statistics
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Professional statistics
 */
router.get('/statistics', authenticate, professionalController.getStatistics.bind(professionalController));

/**
 * @swagger
 * /professionals/schedule-settings:
 *   get:
 *     summary: Get professional schedule settings
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedule settings
 */
router.get('/schedule-settings', authenticate, professionalController.getScheduleSettings.bind(professionalController));

/**
 * @swagger
 * /professionals/{professionalId}:
 *   get:
 *     summary: Get professional details
 *     tags: [Professionals]
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professional details
 */
router.get('/:professionalId', professionalController.getById.bind(professionalController));

/**
 * @swagger
 * /professionals/{professionalId}/availability:
 *   get:
 *     summary: Get professional availability for a specific date
 *     tags: [Professionals]
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Available time slots
 */
router.get('/:professionalId/availability', professionalController.getAvailability.bind(professionalController));

/**
 * @swagger
 * /professionals/{professionalId}/procedures:
 *   get:
 *     summary: Get professional's procedures
 *     tags: [Professionals]
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of procedures
 */
router.get('/:professionalId/procedures', professionalController.getProcedures.bind(professionalController));

/**
 * @swagger
 * /professionals/{professionalId}/reviews:
 *   get:
 *     summary: Get professional's reviews
 *     tags: [Professionals]
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of reviews
 */
router.get('/:professionalId/reviews', professionalController.getReviews.bind(professionalController));

/**
 * @swagger
 * /professionals/profile:
 *   put:
 *     summary: Update professional profile
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationNumber:
 *                 type: string
 *               specialty:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  '/profile',
  authenticate,
  [
    body('registrationNumber').optional().trim(),
    body('specialty').optional().trim(),
    body('bio').optional().trim(),
  ],
  validate,
  professionalController.updateProfile.bind(professionalController)
);

/**
 * @swagger
 * /professionals/schedule-settings:
 *   put:
 *     summary: Update professional schedule settings
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               weeklySchedule:
 *                 type: array
 *               appointmentDuration:
 *                 type: integer
 *               bufferTime:
 *                 type: integer
 *               blockedDates:
 *                 type: array
 *     responses:
 *       200:
 *         description: Schedule settings updated
 */
router.put('/schedule-settings', authenticate, professionalController.updateScheduleSettings.bind(professionalController));

export default router;
