import express from 'express';
import controller from './redemption.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/roleAuth';

const router = express.Router();

/**
 * @swagger
 * /redemptions:
 *   get:
 *     summary: List all redemptions (Admin only)
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: rewardId
 *         schema:
 *           type: string
 *         description: Filter by reward ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [HOLD, REDEEMED, CANCELED, EXPIRED]
 *         description: Filter by status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of redemptions with pagination
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.listAll(req, res));

/**
 * @swagger
 * /redemptions/me:
 *   get:
 *     summary: Get current user's redemptions
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [HOLD, REDEEMED, CANCELED, EXPIRED]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: User's redemptions
 */
router.get('/me', authenticate, (req, res) => controller.getUserRedemptions(req, res));

/**
 * @swagger
 * /redemptions/statistics:
 *   get:
 *     summary: Get redemption statistics (Admin only)
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: rewardId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Redemption statistics
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/statistics', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /redemptions/pending:
 *   get:
 *     summary: Get pending redemptions requiring action (Admin only)
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: expiringIn
 *         schema:
 *           type: integer
 *         description: Filter by expiring in X hours
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Pending redemptions
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/pending', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.getPendingRedemptions(req, res));

/**
 * @swagger
 * /redemptions/expire:
 *   post:
 *     summary: Expire old redemptions (Admin only)
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Redemptions expired successfully
 *       403:
 *         description: Forbidden - Admin only
 */
router.post('/expire', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.expireOldRedemptions(req, res));

/**
 * @swagger
 * /redemptions/{id}:
 *   get:
 *     summary: Get redemption by ID
 *     tags: [Redemptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Redemption details
 *       403:
 *         description: Not authorized to view this redemption
 *       404:
 *         description: Redemption not found
 */
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));

export default router;
