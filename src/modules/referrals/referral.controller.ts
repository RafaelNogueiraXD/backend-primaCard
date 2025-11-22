import { Request, Response } from 'express';
import { ReferralService } from './referral.service';
import logger from '../../config/logger';

const referralService = new ReferralService();

export class ReferralController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const referrerId = req.user!.userId;
      const { referredEmail, referredPhone } = req.body;

      if (!referredEmail && !referredPhone) {
        res.status(400).json({
          errors: [{ message: 'Either referredEmail or referredPhone is required' }],
        });
        return;
      }

      const referral = await referralService.create({
        referrerId,
        referredEmail,
        referredPhone,
      });

      logger.info(`Referral created: ${referral.id} by user ${referrerId}`);
      res.status(201).json({ data: referral });
    } catch (error: any) {
      logger.error('Error creating referral:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to create referral' }],
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const referrerId = req.user!.userId;
      const { status, page, perPage } = req.query;

      const result = await referralService.list(referrerId, {
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing referrals:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list referrals' }],
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const referral = await referralService.getById(id, userId);

      res.json({ data: referral });
    } catch (error: any) {
      logger.error('Error getting referral:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 404;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Referral not found' }],
      });
    }
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const statistics = await referralService.getStatistics(userId);

      res.json({ data: statistics });
    } catch (error: any) {
      logger.error('Error getting referral statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }
}
