import { Router } from 'express';
import { PointsController } from './points.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new PointsController();

/**
 * @swagger
 * /points/balance:
 *   get:
 *     summary: Get points balance for authenticated user
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Points balance by bucket
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPoints:
 *                       type: integer
 *                       example: 125
 *                     balances:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         general: 50
 *                         limpeza: 30
 *                         clareamento: 45
 */
router.get('/balance', authenticate, (req, res) => controller.getBalance(req, res));

/**
 * @swagger
 * /points/transactions:
 *   get:
 *     summary: Get points transaction history
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bucket
 *         schema:
 *           type: string
 *           example: general
 *       - in: query
 *         name: cause
 *         schema:
 *           type: string
 *           enum: [PROCEDURE_COMPLETED, EXACT_TIME, PUNCTUAL, REFERRAL_COMPLETED, REWARD_REDEMPTION, LATE_CANCEL_PENALTY, NO_SHOW_PENALTY, REFUND, ADMIN_ADJUSTMENT]
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
 *         description: List of point transactions
 */
router.get('/transactions', authenticate, (req, res) => controller.getTransactions(req, res));

/**
 * @swagger
 * /points/statistics:
 *   get:
 *     summary: Get points statistics for authenticated user
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Points statistics including earned, spent, and breakdown by cause
 */
router.get('/statistics', authenticate, (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /points/adjust:
 *   post:
 *     summary: Adjust user points (Admin only)
 *     tags: [Points]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - bucket
 *               - delta
 *               - reason
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               bucket:
 *                 type: string
 *                 example: general
 *               delta:
 *                 type: integer
 *                 example: 100
 *                 description: Positive to add, negative to remove
 *               reason:
 *                 type: string
 *                 example: Bonus for feedback
 *     responses:
 *       200:
 *         description: Points adjusted successfully
 *       403:
 *         description: Not authorized - admin only
 */
router.post('/adjust', authenticate, (req, res) => controller.adjustPoints(req, res));

export default router;
