import prisma from '../../config/database';
import { PointsService } from '../points/points.service';

const pointsService = new PointsService();

export class ReferralService {
  async create(data: {
    referrerId: string;
    referredEmail?: string;
    referredPhone?: string;
  }): Promise<any> {
    // Validate that at least email or phone is provided
    if (!data.referredEmail && !data.referredPhone) {
      throw new Error('Either email or phone must be provided');
    }

    // Check if referral already exists
    if (data.referredEmail) {
      const existing = await prisma.referral.findFirst({
        where: {
          referrerId: data.referrerId,
          referredEmail: data.referredEmail,
        },
      });

      if (existing) {
        throw new Error('Referral for this email already exists');
      }
    }

    // Check if referred user is already registered
    if (data.referredEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.referredEmail },
      });

      if (existingUser) {
        // If user exists, link directly
        return prisma.referral.create({
          data: {
            referrerId: data.referrerId,
            referredId: existingUser.id,
            referredEmail: data.referredEmail,
            referredPhone: data.referredPhone,
            status: 'PENDING',
          },
        });
      }
    }

    return prisma.referral.create({
      data: {
        referrerId: data.referrerId,
        referredEmail: data.referredEmail,
        referredPhone: data.referredPhone,
        status: 'PENDING',
      },
    });
  }

  async list(
    referrerId: string,
    filters: {
      status?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{ data: any[]; meta: any }> {
    const page = filters.page || 1;
    const perPage = filters.perPage || 20;
    const skip = (page - 1) * perPage;

    const where: any = { referrerId };

    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.referral.count({ where }),
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

  async getById(id: string, userId: string): Promise<any> {
    const referral = await prisma.referral.findUnique({
      where: { id },
      include: {
        referrer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        referred: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!referral) {
      throw new Error('Referral not found');
    }

    // Check authorization
    if (referral.referrerId !== userId && referral.referredId !== userId) {
      throw new Error('Not authorized');
    }

    return referral;
  }

  async complete(referralId: string): Promise<any> {
    const referral = await prisma.referral.findUnique({
      where: { id: referralId },
    });

    if (!referral) {
      throw new Error('Referral not found');
    }

    if (referral.status !== 'PENDING') {
      throw new Error('Referral already completed or canceled');
    }

    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        awardedAt: new Date(),
        ruleVersion: '1.0',
      },
    });

    // Grant points to referrer
    await pointsService.grantReferralPoints(referral.referrerId, referralId);

    return updated;
  }

  async linkReferredUser(email: string, userId: string): Promise<void> {
    // Find pending referrals for this email
    const referrals = await prisma.referral.findMany({
      where: {
        referredEmail: email,
        status: 'PENDING',
        referredId: null,
      },
    });

    // Link all pending referrals to this user
    for (const referral of referrals) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: { referredId: userId },
      });
    }
  }

  async checkAndCompleteReferral(userId: string): Promise<void> {
    // Find referrals where this user is the referred
    const referrals = await prisma.referral.findMany({
      where: {
        referredId: userId,
        status: 'PENDING',
      },
    });

    // Check if user has completed their first appointment
    const completedAppointment = await prisma.appointment.findFirst({
      where: {
        patientId: userId,
        status: 'COMPLETED',
      },
    });

    if (completedAppointment) {
      // Complete all pending referrals
      for (const referral of referrals) {
        await this.complete(referral.id);
      }
    }
  }

  async getStatistics(userId: string): Promise<any> {
    const [total, pending, completed, totalPoints] = await Promise.all([
      prisma.referral.count({
        where: { referrerId: userId },
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: 'PENDING' },
      }),
      prisma.referral.count({
        where: { referrerId: userId, status: 'COMPLETED' },
      }),
      prisma.pointTransaction.aggregate({
        where: {
          userId,
          cause: 'REFERRAL_COMPLETED',
        },
        _sum: {
          delta: true,
        },
      }),
    ]);

    return {
      totalReferrals: total,
      pendingReferrals: pending,
      completedReferrals: completed,
      totalPointsEarned: totalPoints._sum.delta || 0,
    };
  }
}
