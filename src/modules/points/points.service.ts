import prisma from '../../config/database';
import { config } from '../../config';
import emailService from '../../utils/email.service';
import logger from '../../config/logger';

export class PointsService {
  async createTransaction(data: {
    userId: string;
    bucket: string;
    delta: number;
    cause: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: any;
  }): Promise<any> {
    const transaction = await prisma.pointTransaction.create({
      data: {
        userId: data.userId,
        bucket: data.bucket,
        delta: data.delta,
        cause: data.cause as any,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        metadata: data.metadata,
      },
    });

    // Send email notification if points were credited (delta > 0)
    if (data.delta > 0) {
      try {
        // Get user details
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (user) {
          // Get total balance
          const balances = await this.getBalance(data.userId);
          const totalBalance = Object.values(balances).reduce((sum, val) => sum + val, 0);

          // Map cause to friendly reason
          const reasonMap: { [key: string]: string } = {
            'procedure_completed': 'Consulta concluída',
            'referral_reward': 'Indicação de amigo',
            'manual_adjustment': 'Ajuste manual',
            'punctuality_bonus': 'Bônus de pontualidade',
            'first_appointment': 'Primeira consulta',
          };

          const reason = reasonMap[data.cause] || data.cause;

          // Send email (async, don't wait for it)
          emailService.sendPointsReceivedEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            data.delta,
            reason,
            totalBalance
          ).catch((error) => {
            logger.error(`Failed to send points email to ${user.email}:`, error);
          });

          logger.info(`Points credited notification sent to ${user.email}: +${data.delta} points`);
        }
      } catch (error) {
        // Don't throw error - email failure shouldn't break points transaction
        logger.error('Error sending points notification email:', error);
      }
    }

    return transaction;
  }

  async getBalance(userId: string): Promise<{ [bucket: string]: number }> {
    const transactions = await prisma.pointTransaction.findMany({
      where: { userId },
      select: { bucket: true, delta: true },
    });

    const balances: { [bucket: string]: number } = {};

    transactions.forEach(tx => {
      if (!balances[tx.bucket]) {
        balances[tx.bucket] = 0;
      }
      balances[tx.bucket] += tx.delta;
    });

    return balances;
  }

  async getTransactions(
    userId: string,
    filters: {
      bucket?: string;
      cause?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { userId };

    if (filters.bucket) {
      where.bucket = filters.bucket;
    }

    if (filters.cause) {
      where.cause = filters.cause;
    }

    const [data, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pointTransaction.count({ where }),
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

  async grantProcedurePoints(
    appointmentId: string,
    patientId: string,
    snapshot: any,
    punctualityFlag?: string
  ): Promise<void> {
    // Grant general points
    await this.createTransaction({
      userId: patientId,
      bucket: 'general',
      delta: snapshot.pointsGeneral,
      cause: 'PROCEDURE_COMPLETED',
      referenceType: 'appointment',
      referenceId: appointmentId,
    });

    // Grant category-specific points
    if (snapshot.pointsCategory > 0) {
      await this.createTransaction({
        userId: patientId,
        bucket: snapshot.category,
        delta: snapshot.pointsCategory,
        cause: 'PROCEDURE_COMPLETED',
        referenceType: 'appointment',
        referenceId: appointmentId,
      });
    }

    // Punctuality bonus
    if (punctualityFlag === 'EXACT') {
      await this.createTransaction({
        userId: patientId,
        bucket: 'general',
        delta: 5, // Bonus for exact time
        cause: 'EXACT_TIME',
        referenceType: 'appointment',
        referenceId: appointmentId,
      });
    } else if (punctualityFlag === 'WITHIN_TOLERANCE') {
      await this.createTransaction({
        userId: patientId,
        bucket: 'general',
        delta: 2, // Smaller bonus for within tolerance
        cause: 'PUNCTUAL',
        referenceType: 'appointment',
        referenceId: appointmentId,
      });
    }
  }

  async grantReferralPoints(referrerId: string, referralId: string): Promise<void> {
    await this.createTransaction({
      userId: referrerId,
      bucket: 'general',
      delta: config.referral.pointsGeneral,
      cause: 'REFERRAL_COMPLETED',
      referenceType: 'referral',
      referenceId: referralId,
    });
  }

  async adjustPoints(
    userId: string,
    bucket: string,
    delta: number,
    reason: string
  ): Promise<any> {
    return this.createTransaction({
      userId,
      bucket,
      delta,
      cause: 'ADMIN_ADJUSTMENT',
      metadata: { reason },
    });
  }

  async canAfford(
    userId: string,
    cost: number,
    allowedBuckets: string[],
    excludedBuckets: string[]
  ): Promise<{ canAfford: boolean; breakdown?: { [bucket: string]: number } }> {
    const balances = await this.getBalance(userId);

    // Filter buckets based on rules
    const usableBuckets = Object.keys(balances).filter(
      bucket => 
        (allowedBuckets.length === 0 || allowedBuckets.includes(bucket)) &&
        !excludedBuckets.includes(bucket) &&
        balances[bucket] > 0
    );

    let remaining = cost;
    const breakdown: { [bucket: string]: number } = {};

    // Priority 1: Use general bucket first (unless excluded)
    if (remaining > 0 && usableBuckets.includes('general')) {
      const available = balances['general'];
      const toUse = Math.min(available, remaining);

      breakdown['general'] = toUse;
      remaining -= toUse;
    }

    // Priority 2: Use specific category buckets, ordered by balance (highest first)
    if (remaining > 0) {
      const specificBuckets = usableBuckets
        .filter(b => b !== 'general')
        .sort((a, b) => balances[b] - balances[a]); // Sort descending by balance

      for (const bucket of specificBuckets) {
        if (remaining <= 0) break;

        const available = balances[bucket];
        const toUse = Math.min(available, remaining);

        breakdown[bucket] = toUse;
        remaining -= toUse;
      }
    }

    return {
      canAfford: remaining <= 0,
      breakdown: remaining <= 0 ? breakdown : undefined,
    };
  }

  async deductPoints(breakdown: { [bucket: string]: number }, userId: string, referenceId: string): Promise<void> {
    for (const [bucket, amount] of Object.entries(breakdown)) {
      await this.createTransaction({
        userId,
        bucket,
        delta: -amount,
        cause: 'REWARD_REDEMPTION',
        referenceType: 'redemption',
        referenceId,
      });
    }
  }

  async refundPoints(breakdown: { [bucket: string]: number }, userId: string, referenceId: string): Promise<void> {
    for (const [bucket, amount] of Object.entries(breakdown)) {
      await this.createTransaction({
        userId,
        bucket,
        delta: amount, // Positive to refund
        cause: 'REFUND',
        referenceType: 'redemption',
        referenceId,
      });
    }
  }

  async getAvailableForReward(userId: string, rewardId: string): Promise<{
    totalAvailable: number;
    balances: { [bucket: string]: number };
    excludedBuckets: string[];
  }> {
    // Get reward to check excluded buckets
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
      select: { excludedBuckets: true },
    });

    if (!reward) {
      throw new Error('Reward not found');
    }

    // Get user's point balances
    const balances = await this.getBalance(userId);

    // Calculate total excluding restricted buckets
    const excludedBuckets = (reward.excludedBuckets || []) as string[];
    let totalAvailable = 0;
    const availableBalances: { [bucket: string]: number } = {};

    for (const [bucket, amount] of Object.entries(balances)) {
      if (!excludedBuckets.includes(bucket)) {
        totalAvailable += amount;
        availableBalances[bucket] = amount;
      }
    }

    return {
      totalAvailable,
      balances: availableBalances,
      excludedBuckets,
    };
  }
}
