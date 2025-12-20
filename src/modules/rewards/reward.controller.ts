import { Request, Response } from 'express';
import { RewardService } from './reward.service';
import logger from '../../config/logger';
import prisma from '../../config/database';

const rewardService = new RewardService();

export class RewardController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { name, description, costPoints, allowedBuckets, excludedBuckets, terms, stockQuantity } = req.body;

      if (!name || !costPoints) {
        res.status(400).json({
          errors: [{ message: 'name and costPoints are required' }],
        });
        return;
      }

      let professionalId: string | undefined;

      // Only professionals and admins can create rewards
      if (role === 'PROFESSIONAL') {
        const professional = await prisma.professional.findUnique({
          where: { userId },
        });

        if (!professional) {
          res.status(403).json({
            errors: [{ message: 'Not authorized - user is not a professional' }],
          });
          return;
        }

        professionalId = professional.id;
      } else if (role !== 'ADMIN') {
        res.status(403).json({
          errors: [{ message: 'Not authorized - professionals or admins only' }],
        });
        return;
      }

      const reward = await rewardService.create({
        professionalId,
        name,
        description,
        costPoints,
        allowedBuckets,
        excludedBuckets,
        terms,
        stockQuantity,
      });

      logger.info(`Reward created: ${reward.id}`);
      res.status(201).json({ data: reward });
    } catch (error: any) {
      logger.error('Error creating reward:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to create reward' }],
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const { active, professionalId, page, perPage } = req.query;

      const result = await rewardService.list({
        active: active === 'true' ? true : active === 'false' ? false : undefined,
        professionalId: professionalId as string,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing rewards:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list rewards' }],
      });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const reward = await rewardService.getById(id);

      if (!reward) {
        res.status(404).json({
          errors: [{ message: 'Reward not found' }],
        });
        return;
      }

      res.json({ data: reward });
    } catch (error: any) {
      logger.error('Error getting reward:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get reward' }],
      });
    }
  }

  async redeem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { idempotencyKey, customBreakdown } = req.body;

      const redemption = await rewardService.redeem(id, userId, idempotencyKey, customBreakdown);

      logger.info(`Reward redeemed: ${id} by user ${userId}`);
      res.status(201).json({ data: redemption });
    } catch (error: any) {
      logger.error('Error redeeming reward:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to redeem reward' }],
      });
    }
  }

  async confirmRedemption(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { otpCode } = req.body;

      // Get professional ID from user ID
      const professional = await prisma.professional.findUnique({
        where: { userId },
      });

      if (!professional) {
        res.status(403).json({
          errors: [{ message: 'Not authorized - user is not a professional' }],
        });
        return;
      }

      const redemption = await rewardService.confirm(id, professional.id, otpCode);

      logger.info(`Redemption confirmed: ${id}`);
      res.json({ data: redemption });
    } catch (error: any) {
      logger.error('Error confirming redemption:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to confirm redemption' }],
      });
    }
  }

  async cancelRedemption(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const redemption = await rewardService.cancel(id, userId);

      logger.info(`Redemption canceled: ${id}`);
      res.json({ data: redemption });
    } catch (error: any) {
      logger.error('Error canceling redemption:', error);
      const statusCode = error.message === 'Not authorized' ? 403 : 400;
      res.status(statusCode).json({
        errors: [{ message: error.message || 'Failed to cancel redemption' }],
      });
    }
  }

  async generateOTP(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const otp = await rewardService.generateOTP(id, userId);

      logger.info(`OTP generated for redemption: ${id}`);
      res.json({
        data: {
          otp,
          message: 'OTP generated successfully. Show this code to the professional.',
        },
      });
    } catch (error: any) {
      logger.error('Error generating OTP:', error);
      res.status(400).json({
        errors: [{ message: error.message || 'Failed to generate OTP' }],
      });
    }
  }

  async listRedemptions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, page, perPage } = req.query;

      const result = await rewardService.listRedemptions(userId, {
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20,
      });

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing redemptions:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list redemptions' }],
      });
    }
  }
}
