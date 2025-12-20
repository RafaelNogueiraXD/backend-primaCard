import { Request, Response } from 'express';
import { PointsService } from './points.service';
import logger from '../../config/logger';

const pointsService = new PointsService();

export class PointsController {
  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const balances = await pointsService.getBalance(userId);

      // Calculate total points
      const totalPoints = Object.values(balances).reduce((sum, val) => sum + val, 0);

      res.json({
        data: {
          totalPoints,
          balances,
        },
      });
    } catch (error: any) {
      logger.error('Error getting balance:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get balance' }],
      });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { bucket, cause, page, perPage } = req.query;

      const result = await pointsService.getTransactions(userId, {
        bucket: bucket as string,
        cause: cause as string,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting transactions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get transactions' }],
      });
    }
  }

  async adjustPoints(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bucket, delta, reason } = req.body;

      if (!userId || !bucket || delta === undefined || !reason) {
        res.status(400).json({
          errors: [{ message: 'userId, bucket, delta, and reason are required' }],
        });
        return;
      }

      // Only admins should be able to adjust points
      if (req.user!.role !== 'ADMIN') {
        res.status(403).json({
          errors: [{ message: 'Not authorized - admin only' }],
        });
        return;
      }

      const transaction = await pointsService.adjustPoints(userId, bucket, delta, reason);

      logger.info(`Points adjusted: ${delta} points to user ${userId} in bucket ${bucket}`);
      res.json({ data: transaction });
    } catch (error: any) {
      logger.error('Error adjusting points:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to adjust points' }],
      });
    }
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Get all transactions
      const allTransactions = await pointsService.getTransactions(userId, {});

      // Get current balance
      const balances = await pointsService.getBalance(userId);
      const totalPoints = Object.values(balances).reduce((sum, val) => sum + val, 0);

      // Calculate statistics
      const totalEarned = allTransactions.data
        .filter(tx => tx.delta > 0)
        .reduce((sum, tx) => sum + tx.delta, 0);

      const totalSpent = Math.abs(
        allTransactions.data
          .filter(tx => tx.delta < 0)
          .reduce((sum, tx) => sum + tx.delta, 0)
      );

      // Count by cause
      const byCause = allTransactions.data.reduce((acc, tx) => {
        if (!acc[tx.cause]) {
          acc[tx.cause] = { count: 0, total: 0 };
        }
        acc[tx.cause].count++;
        acc[tx.cause].total += tx.delta;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      res.json({
        data: {
          currentBalance: totalPoints,
          balancesByBucket: balances,
          totalEarned,
          totalSpent,
          totalTransactions: allTransactions.meta.total,
          byCause,
        },
      });
    } catch (error: any) {
      logger.error('Error getting points statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }

  async getAvailableForReward(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { rewardId } = req.params;

      const result = await pointsService.getAvailableForReward(userId, rewardId);

      res.json({ data: result });
    } catch (error: any) {
      logger.error('Error getting available points for reward:', error);
      res.status(error.message === 'Reward not found' ? 404 : 500).json({
        errors: [{ message: error.message || 'Failed to get available points' }],
      });
    }
  }
}
