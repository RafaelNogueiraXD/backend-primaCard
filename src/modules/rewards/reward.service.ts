import prisma from '../../config/database';
import { PointsService } from '../points/points.service';
import { AuthUtils } from '../../utils/authUtils';
import { addDays } from '../../utils/dateUtils';
import { config } from '../../config';

const pointsService = new PointsService();

export class RewardService {
  async create(data: {
    professionalId?: string;
    name: string;
    description?: string;
    costPoints: number;
    allowedBuckets: string[];
    excludedBuckets: string[];
    terms?: string;
    stockQuantity?: number;
  }): Promise<any> {
    return prisma.reward.create({
      data: {
        professionalId: data.professionalId,
        name: data.name,
        description: data.description,
        costPoints: data.costPoints,
        allowedBuckets: data.allowedBuckets,
        excludedBuckets: data.excludedBuckets,
        terms: data.terms,
        stockQuantity: data.stockQuantity,
        stockRemaining: data.stockQuantity,
      },
    });
  }

  async list(filters: {
    active?: boolean;
    professionalId?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};

    if (filters.active !== undefined) {
      where.isActive = filters.active;
    }

    if (filters.professionalId) {
      where.professionalId = filters.professionalId;
    }

    const [data, total] = await Promise.all([
      prisma.reward.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { include: { user: true } },
        },
      }),
      prisma.reward.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async getById(rewardId: string): Promise<any> {
    return prisma.reward.findUnique({
      where: { id: rewardId },
      include: {
        professional: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  async redeem(
    rewardId: string,
    userId: string,
    idempotencyKey?: string,
    customBreakdown?: { [bucket: string]: number }
  ): Promise<any> {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await prisma.redemption.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return existing;
    }

    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward || !reward.isActive) {
      throw new Error('Reward not found or inactive');
    }

    // Check stock
    if (reward.stockRemaining !== null && reward.stockRemaining <= 0) {
      throw new Error('Reward out of stock');
    }

    let breakdown: { [bucket: string]: number };

    // If custom breakdown provided, validate it
    if (customBreakdown) {
      const validation = await this.validateCustomBreakdown(
        customBreakdown,
        userId,
        reward.costPoints,
        reward.allowedBuckets as string[],
        reward.excludedBuckets as string[]
      );

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid points breakdown');
      }

      breakdown = customBreakdown;
    } else {
      // Use automatic calculation
      const affordability = await pointsService.canAfford(
        userId,
        reward.costPoints,
        reward.allowedBuckets as string[],
        reward.excludedBuckets as string[]
      );

      if (!affordability.canAfford) {
        throw new Error('Insufficient points');
      }

      breakdown = affordability.breakdown!;
    }

    // Create redemption with transaction
    const redemption = await prisma.$transaction(async (tx) => {
      // Deduct stock
      if (reward.stockRemaining !== null) {
        await tx.reward.update({
          where: { id: rewardId },
          data: { stockRemaining: { decrement: 1 } },
        });
      }

      // Create redemption in HOLD status
      const expiresAt = addDays(new Date(), config.redemption.holdExpiryDays);

      const newRedemption = await tx.redemption.create({
        data: {
          rewardId,
          userId,
          status: 'HOLD',
          holdBreakdown: breakdown,
          expiresAt,
          idempotencyKey,
        },
      });

      return newRedemption;
    });

    // Deduct points using the breakdown
    await pointsService.deductPoints(breakdown, userId, redemption.id);

    return redemption;
  }

  private async validateCustomBreakdown(
    breakdown: { [bucket: string]: number },
    userId: string,
    cost: number,
    allowedBuckets: string[],
    excludedBuckets: string[]
  ): Promise<{ valid: boolean; error?: string }> {
    // Get user's balance
    const balances = await pointsService.getBalance(userId);

    // Calculate total from breakdown
    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    // Check if total matches cost
    if (total !== cost) {
      return { valid: false, error: `Total points (${total}) must equal cost (${cost})` };
    }

    // Validate each bucket
    for (const [bucket, amount] of Object.entries(breakdown)) {
      if (amount < 0) {
        return { valid: false, error: `Amount for ${bucket} cannot be negative` };
      }

      if (amount === 0) continue; // Skip zero amounts

      // Check if bucket exists in user's balance
      if (!balances[bucket]) {
        return { valid: false, error: `Invalid bucket: ${bucket}` };
      }

      // Check if user has enough points in this bucket
      if (balances[bucket] < amount) {
        return { valid: false, error: `Insufficient points in ${bucket} bucket (have: ${balances[bucket]}, need: ${amount})` };
      }

      // Check if bucket is allowed
      if (allowedBuckets.length > 0 && !allowedBuckets.includes(bucket)) {
        return { valid: false, error: `Bucket ${bucket} is not allowed for this reward` };
      }

      // Check if bucket is excluded
      if (excludedBuckets.includes(bucket)) {
        return { valid: false, error: `Bucket ${bucket} is excluded from this reward` };
      }
    }

    return { valid: true };
  }

  async confirm(
    redemptionId: string,
    professionalId: string,
    otpCode?: string
  ): Promise<any> {
    const redemption = await prisma.redemption.findUnique({
      where: { id: redemptionId },
      include: { reward: true },
    });

    if (!redemption) {
      throw new Error('Redemption not found');
    }

    if (redemption.status !== 'HOLD') {
      throw new Error('Redemption cannot be confirmed');
    }

    if (redemption.reward.professionalId !== professionalId) {
      throw new Error('Not authorized');
    }

    // Check expiration
    if (new Date() > redemption.expiresAt) {
      throw new Error('Redemption has expired');
    }

    // Verify OTP if provided
    if (otpCode && redemption.otpCodeHash) {
      const otpHash = AuthUtils.hashOTP(otpCode);
      if (otpHash !== redemption.otpCodeHash || new Date() > redemption.otpExpiresAt!) {
        throw new Error('Invalid or expired OTP');
      }
    }

    return prisma.redemption.update({
      where: { id: redemptionId },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
      },
    });
  }

  async cancel(redemptionId: string, userId: string): Promise<any> {
    const redemption = await prisma.redemption.findUnique({
      where: { id: redemptionId },
      include: { reward: true },
    });

    if (!redemption) {
      throw new Error('Redemption not found');
    }

    if (redemption.userId !== userId) {
      throw new Error('Not authorized');
    }

    if (redemption.status !== 'HOLD') {
      throw new Error('Redemption cannot be canceled');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Restore stock
      if (redemption.reward.stockRemaining !== null) {
        await tx.reward.update({
          where: { id: redemption.rewardId },
          data: { stockRemaining: { increment: 1 } },
        });
      }

      return tx.redemption.update({
        where: { id: redemptionId },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });
    });

    // Refund points
    await pointsService.refundPoints(
      redemption.holdBreakdown as any,
      userId,
      redemptionId
    );

    return updated;
  }

  async generateOTP(redemptionId: string, userId: string): Promise<string> {
    const redemption = await prisma.redemption.findUnique({
      where: { id: redemptionId },
    });

    if (!redemption || redemption.userId !== userId) {
      throw new Error('Redemption not found');
    }

    if (redemption.status !== 'HOLD') {
      throw new Error('Cannot generate OTP for this redemption');
    }

    const otp = AuthUtils.generateOTP();
    const otpHash = AuthUtils.hashOTP(otp);
    const otpExpiresAt = addDays(new Date(), 0, 0, 10); // 10 minutes

    await prisma.redemption.update({
      where: { id: redemptionId },
      data: {
        otpCodeHash: otpHash,
        otpExpiresAt,
      },
    });

    return otp; // In production, send via SMS/email
  }

  async listRedemptions(
    userId: string,
    filters: {
      status?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      prisma.redemption.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: { reward: true },
      }),
      prisma.redemption.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }
}
