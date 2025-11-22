import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

export class RedemptionService {
  /**
   * List all redemptions with filters (admin)
   */
  async listAll(filters: {
    userId?: string;
    rewardId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.RedemptionWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.rewardId) {
      where.rewardId = filters.rewardId;
    }

    if (filters.status) {
      where.status = filters.status as any;
    }

    if (filters.startDate || filters.endDate) {
      where.requestedAt = {};
      if (filters.startDate) {
        where.requestedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.requestedAt.lte = filters.endDate;
      }
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reward: {
            select: {
              id: true,
              name: true,
              description: true,
              costPoints: true,
            },
          },
        },
      }),
      prisma.redemption.count({ where }),
    ]);

    return {
      data: redemptions,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get redemption by ID
   */
  async getById(id: string, userId?: string): Promise<any> {
    const where: Prisma.RedemptionWhereInput = { id };

    // If userId provided, ensure user owns the redemption
    if (userId) {
      where.userId = userId;
    }

    const redemption = await prisma.redemption.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        reward: {
          select: {
            id: true,
            name: true,
            description: true,
            costPoints: true,
            stockRemaining: true,
            isActive: true,
          },
        },
      },
    });

    if (!redemption) {
      throw new Error('Redemption not found');
    }

    return redemption;
  }

  /**
   * Get redemption statistics (admin)
   */
  async getStatistics(filters?: {
    startDate?: Date;
    endDate?: Date;
    rewardId?: string;
  }): Promise<any> {
    const where: Prisma.RedemptionWhereInput = {};

    if (filters?.startDate || filters?.endDate) {
      where.requestedAt = {};
      if (filters.startDate) {
        where.requestedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.requestedAt.lte = filters.endDate;
      }
    }

    if (filters?.rewardId) {
      where.rewardId = filters.rewardId;
    }

    const [
      totalRedemptions,
      holdRedemptions,
      redeemedRedemptions,
      canceledRedemptions,
      expiredRedemptions,
    ] = await Promise.all([
      prisma.redemption.count({ where }),
      prisma.redemption.count({ where: { ...where, status: 'HOLD' } }),
      prisma.redemption.count({ where: { ...where, status: 'REDEEMED' } }),
      prisma.redemption.count({ where: { ...where, status: 'CANCELED' } }),
      prisma.redemption.count({ where: { ...where, status: 'EXPIRED' } }),
    ]);

    // Get most redeemed rewards
    const topRewards = await prisma.redemption.groupBy({
      by: ['rewardId'],
      where: { ...where, status: 'REDEEMED' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const rewardDetails = await prisma.reward.findMany({
      where: {
        id: { in: topRewards.map((r) => r.rewardId) },
      },
      select: {
        id: true,
        name: true,
        costPoints: true,
      },
    });

    const topRewardsWithDetails = topRewards.map((tr) => {
      const reward = rewardDetails.find((r) => r.id === tr.rewardId);
      return {
        rewardId: tr.rewardId,
        rewardName: reward?.name || 'Unknown',
        costPoints: reward?.costPoints || 0,
        count: tr._count?.id || 0,
      };
    });

    return {
      totalRedemptions,
      holdRedemptions,
      redeemedRedemptions,
      canceledRedemptions,
      expiredRedemptions,
      conversionRate: totalRedemptions > 0 
        ? ((redeemedRedemptions / totalRedemptions) * 100).toFixed(2) 
        : 0,
      topRewards: topRewardsWithDetails,
    };
  }

  /**
   * Get user redemption history
   */
  async getUserRedemptions(
    userId: string,
    filters: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.RedemptionWhereInput = { userId };

    if (filters.status) {
      where.status = filters.status as any;
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          reward: {
            select: {
              id: true,
              name: true,
              description: true,
              costPoints: true,
            },
          },
        },
      }),
      prisma.redemption.count({ where }),
    ]);

    return {
      data: redemptions,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Expire old redemptions (admin/cron)
   */
  async expireOldRedemptions(): Promise<any> {
    const result = await prisma.redemption.updateMany({
      where: {
        status: 'HOLD',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return {
      expiredCount: result.count,
    };
  }

  /**
   * Get pending redemptions requiring action
   */
  async getPendingRedemptions(filters?: {
    expiringIn?: number; // hours
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.RedemptionWhereInput = {
      status: 'HOLD',
    };

    if (filters?.expiringIn) {
      const expiringDate = new Date();
      expiringDate.setHours(expiringDate.getHours() + filters.expiringIn);
      where.expiresAt = {
        lte: expiringDate,
        gte: new Date(),
      };
    }

    const [redemptions, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiresAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          reward: {
            select: {
              id: true,
              name: true,
              costPoints: true,
            },
          },
        },
      }),
      prisma.redemption.count({ where }),
    ]);

    return {
      data: redemptions,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
