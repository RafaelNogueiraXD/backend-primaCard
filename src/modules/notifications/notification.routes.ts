import express from 'express';
import controller from './notification.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/roleAuth';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get current user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [APPOINTMENT_REQUESTED, APPOINTMENT_ACCEPTED, APPOINTMENT_CANCELED, APPOINTMENT_REMINDER, REVIEW_PENDING, POINTS_EARNED, REDEMPTION_EXPIRING, REDEMPTION_CONFIRMED, REFERRAL_COMPLETED]
 *         description: Filter by notification type
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
 *         description: List of notifications
 */
router.get('/', authenticate, (req, res) => controller.getMyNotifications(req, res));

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 */
router.get('/unread-count', authenticate, (req, res) => controller.getUnreadCount(req, res));

/**
 * @swagger
 * /notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/mark-all-read', authenticate, (req, res) => controller.markAllAsRead(req, res));

/**
 * @swagger
 * /notifications/delete-all:
 *   delete:
 *     summary: Delete all user notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications deleted
 */
router.delete('/delete-all', authenticate, (req, res) => controller.deleteAll(req, res));

/**
 * @swagger
 * /notifications/all:
 *   get:
 *     summary: List all notifications (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
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
 *         description: List of all notifications
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/all', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.listAll(req, res));

/**
 * @swagger
 * /notifications/statistics:
 *   get:
 *     summary: Get notification statistics (Admin only)
 *     tags: [Notifications]
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
 *         name: userId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification statistics
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/statistics', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
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
 *         description: Notification details
 *       404:
 *         description: Notification not found
 */
router.get('/:id', authenticate, (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.post('/:id/read', authenticate, (req, res) => controller.markAsRead(req, res));

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Notification deleted
 *       404:
 *         description: Notification not found
 */
router.delete('/:id', authenticate, (req, res) => controller.delete(req, res));

export default router;
