import { Router } from 'express';
import { body } from 'express-validator';
import { UserController } from './user.controller';
import { validate } from '../../middleware/validation';
import { authenticate } from '../../middleware/auth';

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/profile', userController.getProfile.bind(userController));

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  '/profile',
  [
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('phone').optional().trim(),
  ],
  validate,
  userController.updateProfile.bind(userController)
);

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  userController.changePassword.bind(userController)
);

/**
 * @swagger
 * /users/delete-account:
 *   delete:
 *     summary: Delete user account (soft delete)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
router.delete('/delete-account', userController.deleteAccount.bind(userController));

/**
 * @swagger
 * /users/points/balance:
 *   get:
 *     summary: Get user points balance
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Points balance retrieved successfully
 */
router.get('/points/balance', userController.getPointsBalance.bind(userController));

/**
 * @swagger
 * /users/points/history:
 *   get:
 *     summary: Get user points transaction history
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bucket
 *         schema:
 *           type: string
 *       - in: query
 *         name: cause
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
 *         description: Points history retrieved successfully
 */
router.get('/points/history', userController.getPointsHistory.bind(userController));

/**
 * @swagger
 * /users/appointments:
 *   get:
 *     summary: Get user appointments
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
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
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointments retrieved successfully
 */
router.get('/appointments', userController.getMyAppointments.bind(userController));

/**
 * @swagger
 * /users/redemptions:
 *   get:
 *     summary: Get user redemptions
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
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
 *         description: Redemptions retrieved successfully
 */
router.get('/redemptions', userController.getMyRedemptions.bind(userController));

/**
 * @swagger
 * /users/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/notifications', userController.getNotifications.bind(userController));

/**
 * @swagger
 * /users/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/notifications/:notificationId/read', userController.markNotificationAsRead.bind(userController));

/**
 * @swagger
 * /users/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/notifications/read-all', userController.markAllNotificationsAsRead.bind(userController));

/**
 * @swagger
 * /users/referral-code:
 *   get:
 *     summary: Get or generate user's referral code
 *     description: Returns existing referral code or generates a new unique one
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code retrieved or generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     referralCode:
 *                       type: string
 *                       example: RAFNOG1234
 */
router.get('/referral-code', userController.getReferralCode.bind(userController));

export default router;
