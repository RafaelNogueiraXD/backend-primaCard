import { Request, Response } from 'express';
import { ReviewService } from './review.service';
import logger from '../../config/logger';

const reviewService = new ReviewService();

export class ReviewController {
  /**
   * Create a new review
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { 
        appointmentId, 
        targetId, 
        rating, 
        comment, 
        tags,
        // Feedback fields matching schema
        wasLate,
        lateMinutes,
        wouldRecommend,
        serviceQuality,
        communication,
        cleanliness,
        punctualityRating,
        patientCooperation,
        followedInstructions,
        waitingTime,
        explanationClarity,
        painManagement
      } = req.body;

      if (!appointmentId || !targetId || !rating) {
        res.status(400).json({
          errors: [
            { message: 'appointmentId, targetId, and rating are required' },
          ],
        });
        return;
      }

      const review = await reviewService.create({
        appointmentId,
        authorId: userId,
        targetId,
        rating: parseInt(rating, 10),
        comment,
        tags,
        // Feedback fields
        wasLate: wasLate !== undefined ? Boolean(wasLate) : undefined,
        lateMinutes: lateMinutes ? parseInt(lateMinutes, 10) : undefined,
        wouldRecommend: wouldRecommend !== undefined ? Boolean(wouldRecommend) : undefined,
        serviceQuality: serviceQuality ? parseInt(serviceQuality, 10) : undefined,
        communication: communication ? parseInt(communication, 10) : undefined,
        cleanliness: cleanliness ? parseInt(cleanliness, 10) : undefined,
        punctualityRating: punctualityRating ? parseInt(punctualityRating, 10) : undefined,
        patientCooperation: patientCooperation ? parseInt(patientCooperation, 10) : undefined,
        followedInstructions: followedInstructions !== undefined ? Boolean(followedInstructions) : undefined,
        waitingTime: waitingTime ? parseInt(waitingTime, 10) : undefined,
        explanationClarity: explanationClarity ? parseInt(explanationClarity, 10) : undefined,
        painManagement: painManagement ? parseInt(painManagement, 10) : undefined,
      });

      logger.info(`Review created: ${review.id}`);
      res.status(201).json({ data: review });
    } catch (error: any) {
      logger.error('Error creating review:', error);
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to create review' }],
      });
    }
  }

  /**
   * Get reviews for a user (reviews they received)
   */
  async getReviewsForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { minRating, maxRating, page, limit } = req.query;

      const filters: any = {};
      if (minRating) filters.minRating = parseInt(minRating as string, 10);
      if (maxRating) filters.maxRating = parseInt(maxRating as string, 10);
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await reviewService.getReviewsForUser(userId, filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting reviews for user:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get reviews' }],
      });
    }
  }

  /**
   * Get reviews by current user (reviews they wrote)
   */
  async getMyReviews(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { page, limit } = req.query;

      const filters: any = {};
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await reviewService.getReviewsByUser(userId, filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting user reviews:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get reviews' }],
      });
    }
  }

  /**
   * Get a specific review by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const review = await reviewService.getById(id);

      res.json({ data: review });
    } catch (error: any) {
      logger.error('Error getting review:', error);
      const status = error.message === 'Review not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to get review' }],
      });
    }
  }

  /**
   * Update a review
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.user as any;
      const { rating, comment, tags } = req.body;

      const data: any = {};
      if (rating !== undefined) data.rating = parseInt(rating, 10);
      if (comment !== undefined) data.comment = comment;
      if (tags !== undefined) data.tags = tags;

      const review = await reviewService.update(id, userId, data);

      logger.info(`Review updated: ${id}`);
      res.json({ data: review });
    } catch (error: any) {
      logger.error('Error updating review:', error);
      const status = error.message.includes('not found')
        ? 404
        : error.message.includes('authorized')
        ? 403
        : 400;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to update review' }],
      });
    }
  }

  /**
   * Delete a review
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, role } = req.user as any;

      await reviewService.delete(id, userId, role === 'ADMIN');

      logger.info(`Review deleted: ${id}`);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Error deleting review:', error);
      const status = error.message.includes('not found')
        ? 404
        : error.message.includes('authorized')
        ? 403
        : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to delete review' }],
      });
    }
  }

  /**
   * Get review statistics for a user
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const stats = await reviewService.getStatistics(userId);

      res.json({ data: stats });
    } catch (error: any) {
      logger.error('Error getting review statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }

  /**
   * Moderate a review (admin only)
   */
  async moderate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isModerated, moderationNote } = req.body;

      if (isModerated === undefined) {
        res.status(400).json({
          errors: [{ message: 'isModerated is required' }],
        });
        return;
      }

      const review = await reviewService.moderate(id, {
        isModerated,
        moderationNote,
      });

      logger.info(`Review moderated: ${id}`);
      res.json({ data: review });
    } catch (error: any) {
      logger.error('Error moderating review:', error);
      const status = error.message === 'Review not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to moderate review' }],
      });
    }
  }

  /**
   * List all reviews (admin only)
   */
  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const {
        isModerated,
        minRating,
        maxRating,
        targetId,
        authorId,
        page,
        limit,
      } = req.query;

      const filters: any = {};
      if (isModerated !== undefined)
        filters.isModerated = isModerated === 'true';
      if (minRating) filters.minRating = parseInt(minRating as string, 10);
      if (maxRating) filters.maxRating = parseInt(maxRating as string, 10);
      if (targetId) filters.targetId = targetId as string;
      if (authorId) filters.authorId = authorId as string;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await reviewService.listAll(filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing reviews:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list reviews' }],
      });
    }
  }
}

export default new ReviewController();
