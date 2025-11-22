import express from 'express';
import controller from './review.controller';
import { authenticate } from '../../middleware/auth';
import { authorizeRoles } from '../../middleware/roleAuth';

const router = express.Router();

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *               - targetId
 *               - rating
 *             properties:
 *               appointmentId:
 *                 type: string
 *               targetId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Invalid input or appointment not completed
 *       404:
 *         description: Appointment not found
 */
router.post('/', authenticate, (req, res) => controller.create(req, res));

/**
 * @swagger
 * /reviews/me:
 *   get:
 *     summary: Get reviews written by current user
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: List of reviews written by user
 */
router.get('/me', authenticate, (req, res) => controller.getMyReviews(req, res));

/**
 * @swagger
 * /reviews/all:
 *   get:
 *     summary: List all reviews (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isModerated
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: integer
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: authorId
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
 *         description: List of all reviews
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/all', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.listAll(req, res));

/**
 * @swagger
 * /reviews/user/{userId}:
 *   get:
 *     summary: Get reviews for a specific user (reviews they received)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *       - in: query
 *         name: maxRating
 *         schema:
 *           type: integer
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
 *         description: List of reviews for user
 */
router.get('/user/:userId', (req, res) => controller.getReviewsForUser(req, res));

/**
 * @swagger
 * /reviews/user/{userId}/statistics:
 *   get:
 *     summary: Get review statistics for a user
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review statistics
 */
router.get('/user/:userId/statistics', (req, res) => controller.getStatistics(req, res));

/**
 * @swagger
 * /reviews/{id}:
 *   get:
 *     summary: Get a specific review by ID
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details
 *       404:
 *         description: Review not found
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /reviews/{id}:
 *   put:
 *     summary: Update a review (within 7 days)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       403:
 *         description: Not authorized or time limit exceeded
 *       404:
 *         description: Review not found
 */
router.put('/:id', authenticate, (req, res) => controller.update(req, res));

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
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
 *         description: Review deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Review not found
 */
router.delete('/:id', authenticate, (req, res) => controller.delete(req, res));

/**
 * @swagger
 * /reviews/{id}/moderate:
 *   post:
 *     summary: Moderate a review (Admin only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isModerated
 *             properties:
 *               isModerated:
 *                 type: boolean
 *               moderationNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Review not found
 */
router.post('/:id/moderate', authenticate, authorizeRoles(['ADMIN']), (req, res) => controller.moderate(req, res));

export default router;
