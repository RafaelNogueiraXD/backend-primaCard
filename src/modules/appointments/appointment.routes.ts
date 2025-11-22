import { Router } from 'express';
import { AppointmentController } from './appointment.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new AppointmentController();

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - professionalId
 *               - procedureId
 *               - startsAt
 *             properties:
 *               professionalId:
 *                 type: string
 *                 format: uuid
 *               procedureId:
 *                 type: string
 *                 format: uuid
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *       400:
 *         description: Invalid data or time conflict
 */
router.post('/', authenticate, (req, res) => controller.create(req, res));

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: List appointments for authenticated user
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [REQUESTED, SCHEDULED, COMPLETED, CANCELED_BY_PATIENT, CANCELED_BY_PROFESSIONAL, NO_SHOW_PATIENT]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of appointments
 */
router.get('/', authenticate, (req, res) => controller.list(req, res));

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     summary: Get appointment details
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Appointment not found
 */
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /appointments/{id}/accept:
 *   post:
 *     summary: Accept a requested appointment (Professional only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment accepted
 *       400:
 *         description: Cannot accept appointment in current state
 *       403:
 *         description: Not authorized
 */
router.post('/:id/accept', authenticate, (req, res) => controller.accept(req, res));

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   post:
 *     summary: Cancel an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment canceled
 *       400:
 *         description: Cannot cancel appointment in current state
 *       403:
 *         description: Not authorized
 */
router.post('/:id/cancel', authenticate, (req, res) => controller.cancel(req, res));

/**
 * @swagger
 * /appointments/{id}/arrival:
 *   post:
 *     summary: Mark patient arrival (Professional only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               arrivalMarkedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Arrival marked successfully
 *       400:
 *         description: Cannot mark arrival for this appointment
 *       403:
 *         description: Not authorized
 */
router.post('/:id/arrival', authenticate, (req, res) => controller.markArrival(req, res));

/**
 * @swagger
 * /appointments/{id}/complete:
 *   post:
 *     summary: Mark appointment as completed (Professional only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment completed
 *       400:
 *         description: Cannot complete this appointment
 *       403:
 *         description: Not authorized
 */
router.post('/:id/complete', authenticate, (req, res) => controller.complete(req, res));

/**
 * @swagger
 * /appointments/{id}/no-show:
 *   post:
 *     summary: Mark appointment as no-show (Professional only)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Appointment marked as no-show
 *       400:
 *         description: Cannot mark no-show for this appointment
 *       403:
 *         description: Not authorized
 */
router.post('/:id/no-show', authenticate, (req, res) => controller.markNoShow(req, res));

export default router;
