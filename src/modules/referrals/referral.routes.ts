import { Router } from 'express';
import { ReferralController } from './referral.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ReferralController();

/**
 * @swagger
 * /referrals:
 *   post:
 *     summary: Create a new referral
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               referredEmail:
 *                 type: string
 *                 format: email
 *                 example: "amigo@email.com"
 *               referredPhone:
 *                 type: string
 *                 example: "+5511988887777"
 *             oneOf:
 *               - required: [referredEmail]
 *               - required: [referredPhone]
 *     responses:
 *       201:
 *         description: Referral created successfully
 *       400:
 *         description: Invalid data or referral already exists
 */
router.post('/', authenticate, (req, res) => controller.create(req, res));

/**
 * @swagger
 * /referrals:
 *   get:
 *     summary: List user's referrals
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, EXPIRED]
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
 *         description: List of referrals
 */
router.get('/', authenticate, (req, res) => controller.list(req, res));

/**
 * @swagger
 * /referrals/statistics:
 *   get:
 *     summary: Get referral statistics for authenticated user
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral statistics including total, pending, completed, and points earned
 */
router.get('/statistics', authenticate, (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /referrals/{id}:
 *   get:
 *     summary: Get referral details
 *     tags: [Referrals]
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
 *         description: Referral details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Referral not found
 */
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /referrals/generate:
 *   post:
 *     summary: Generate a referral code
 *     tags: [Referrals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code generated
 */
router.post('/generate', authenticate, (req, res) => controller.generateCode(req, res));

export default router;
