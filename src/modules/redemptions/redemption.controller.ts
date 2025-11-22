import { Request, Response } from 'express';
import { RedemptionService } from './redemption.service';
import logger from '../../config/logger';

const redemptionService = new RedemptionService();

export class RedemptionController {
  /**
   * List all redemptions (admin)
   */
  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        rewardId,
        status,
        startDate,
        endDate,
        page,
        limit,
      } = req.query;

      const filters: any = {};

      if (userId) filters.userId = userId as string;
      if (rewardId) filters.rewardId = rewardId as string;
      if (status) filters.status = status as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await redemptionService.listAll(filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing redemptions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list redemptions' }],
      });
    }
  }

  /**
   * Get redemption by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, role } = req.user as any;

      // If not admin, ensure user owns the redemption
      const redemptionUserId = role === 'ADMIN' ? undefined : userId;

      const redemption = await redemptionService.getById(id, redemptionUserId);

      res.json({ data: redemption });
    } catch (error: any) {
      logger.error('Error getting redemption:', error);
      const status = error.message === 'Redemption not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to get redemption' }],
      });
    }
  }

  /**
   * Get redemption statistics (admin)
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, rewardId } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (rewardId) filters.rewardId = rewardId as string;

      const stats = await redemptionService.getStatistics(filters);

      res.json({ data: stats });
    } catch (error: any) {
      logger.error('Error getting redemption statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }

  /**
   * Get user redemption history
   */
  async getUserRedemptions(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { status, page, limit } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await redemptionService.getUserRedemptions(userId, filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting user redemptions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get user redemptions' }],
      });
    }
  }

  /**
   * Expire old redemptions (admin/cron)
   */
  async expireOldRedemptions(_req: Request, res: Response): Promise<void> {
    try {
      const result = await redemptionService.expireOldRedemptions();

      logger.info(`Expired ${result.expiredCount} redemptions`);
      res.json({ data: result });
    } catch (error: any) {
      logger.error('Error expiring redemptions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to expire redemptions' }],
      });
    }
  }

  /**
   * Get pending redemptions requiring action (admin)
   */
  async getPendingRedemptions(req: Request, res: Response): Promise<void> {
    try {
      const { expiringIn, page, limit } = req.query;

      const filters: any = {};
      if (expiringIn) filters.expiringIn = parseInt(expiringIn as string, 10);
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await redemptionService.getPendingRedemptions(filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting pending redemptions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get pending redemptions' }],
      });
    }
  }
}

export default new RedemptionController();
