import { Router } from 'express';
import { RewardController } from './reward.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new RewardController();

/**
 * @swagger
 * /rewards:
 *   post:
 *     summary: Create a new reward (Professional or Admin only)
 *     tags: [Rewards]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - costPoints
 *               - allowedBuckets
 *               - excludedBuckets
 *             properties:
 *               name:
 *                 type: string
 *                 example: "10% de desconto na próxima consulta"
 *               description:
 *                 type: string
 *               costPoints:
 *                 type: integer
 *                 example: 50
 *               allowedBuckets:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["general", "limpeza"]
 *               excludedBuckets:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *               terms:
 *                 type: string
 *               stockQuantity:
 *                 type: integer
 *                 example: 100
 *     responses:
 *       201:
 *         description: Reward created successfully
 *       403:
 *         description: Not authorized
 */
router.post('/', authenticate, (req, res) => controller.create(req, res));

/**
 * @swagger
 * /rewards:
 *   get:
 *     summary: List available rewards
 *     tags: [Rewards]
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: professionalId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: List of rewards
 */
router.get('/', (req, res) => controller.list(req, res));

/**
 * @swagger
 * /rewards/{id}:
 *   get:
 *     summary: Get reward details by ID
 *     tags: [Rewards]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reward details
 *       404:
 *         description: Reward not found
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /rewards/{id}/redeem:
 *   post:
 *     summary: Redeem a reward
 *     tags: [Rewards]
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
 *               idempotencyKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reward redeemed successfully, status is HOLD
 *       400:
 *         description: Insufficient points or out of stock
 */
router.post('/:id/redeem', authenticate, (req, res) => controller.redeem(req, res));

/**
 * @swagger
 * /rewards/redemptions:
 *   get:
 *     summary: List user redemptions
 *     tags: [Rewards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [HOLD, REDEEMED, CANCELED, EXPIRED]
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
 *         description: List of redemptions
 */
router.get('/redemptions', authenticate, (req, res) => controller.listRedemptions(req, res));

/**
 * @swagger
 * /rewards/redemptions/{id}/otp:
 *   post:
 *     summary: Generate OTP for redemption
 *     tags: [Rewards]
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
 *         description: OTP generated successfully
 *       400:
 *         description: Cannot generate OTP for this redemption
 */
router.post('/redemptions/:id/otp', authenticate, (req, res) => controller.generateOTP(req, res));

/**
 * @swagger
 * /rewards/redemptions/{id}/confirm:
 *   post:
 *     summary: Confirm a redemption (Professional only)
 *     tags: [Rewards]
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
 *               otpCode:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Redemption confirmed
 *       400:
 *         description: Invalid OTP or expired redemption
 *       403:
 *         description: Not authorized
 */
router.post('/redemptions/:id/confirm', authenticate, (req, res) => controller.confirmRedemption(req, res));

/**
 * @swagger
 * /rewards/redemptions/{id}/cancel:
 *   post:
 *     summary: Cancel a redemption
 *     tags: [Rewards]
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
 *         description: Redemption canceled, points refunded
 *       400:
 *         description: Cannot cancel this redemption
 *       403:
 *         description: Not authorized
 */
router.post('/redemptions/:id/cancel', authenticate, (req, res) => controller.cancelRedemption(req, res));

export default router;
