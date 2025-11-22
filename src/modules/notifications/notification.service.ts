import prisma from '../../config/database';
import { Prisma, NotificationType } from '@prisma/client';

export class NotificationService {
  /**
   * Create a notification
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }): Promise<any> {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
      },
    });

    return notification;
  }

  /**
   * Create multiple notifications (bulk)
   */
  async createBulk(notifications: Array<{
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
  }>): Promise<any> {
    const created = await prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data || {},
      })),
    });

    return { count: created.count };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    filters?: {
      isRead?: boolean;
      type?: NotificationType;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };

    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  /**
   * Get notification by ID
   */
  async getById(id: string, userId?: string): Promise<any> {
    const where: any = { id };

    if (userId) {
      where.userId = userId;
    }

    const notification = await prisma.notification.findFirst({
      where,
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<any> {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<any> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Delete notification
   */
  async delete(id: string, userId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAll(userId: string): Promise<any> {
    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    return { count: result.count };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return count;
  }

  /**
   * Send appointment requested notification
   */
  async notifyAppointmentRequested(
    professionalId: string,
    appointmentData: {
      id: string;
      patientName: string;
      startsAt: Date;
      procedureName: string;
    }
  ): Promise<void> {
    await this.create({
      userId: professionalId,
      type: 'APPOINTMENT_REQUESTED',
      title: 'Nova solicitação de agendamento',
      message: `${appointmentData.patientName} solicitou um agendamento para ${appointmentData.procedureName}`,
      data: {
        appointmentId: appointmentData.id,
        startsAt: appointmentData.startsAt,
      },
    });
  }

  /**
   * Send appointment accepted notification
   */
  async notifyAppointmentAccepted(
    patientId: string,
    appointmentData: {
      id: string;
      professionalName: string;
      startsAt: Date;
      procedureName: string;
    }
  ): Promise<void> {
    await this.create({
      userId: patientId,
      type: 'APPOINTMENT_ACCEPTED',
      title: 'Agendamento confirmado',
      message: `Seu agendamento com ${appointmentData.professionalName} foi confirmado`,
      data: {
        appointmentId: appointmentData.id,
        startsAt: appointmentData.startsAt,
      },
    });
  }

  /**
   * Send appointment canceled notification
   */
  async notifyAppointmentCanceled(
    userId: string,
    appointmentData: {
      id: string;
      otherPartyName: string;
      startsAt: Date;
      reason?: string;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'APPOINTMENT_CANCELED',
      title: 'Agendamento cancelado',
      message: appointmentData.reason
        ? `Agendamento cancelado: ${appointmentData.reason}`
        : 'Seu agendamento foi cancelado',
      data: {
        appointmentId: appointmentData.id,
        startsAt: appointmentData.startsAt,
      },
    });
  }

  /**
   * Send appointment reminder
   */
  async notifyAppointmentReminder(
    userId: string,
    appointmentData: {
      id: string;
      otherPartyName: string;
      startsAt: Date;
      procedureName: string;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'APPOINTMENT_REMINDER',
      title: 'Lembrete de agendamento',
      message: `Você tem um agendamento amanhã com ${appointmentData.otherPartyName}`,
      data: {
        appointmentId: appointmentData.id,
        startsAt: appointmentData.startsAt,
      },
    });
  }

  /**
   * Send review pending notification
   */
  async notifyReviewPending(
    userId: string,
    appointmentData: {
      id: string;
      otherPartyName: string;
      procedureName: string;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'REVIEW_PENDING',
      title: 'Avalie seu atendimento',
      message: `Como foi seu atendimento com ${appointmentData.otherPartyName}?`,
      data: {
        appointmentId: appointmentData.id,
      },
    });
  }

  /**
   * Send points earned notification
   */
  async notifyPointsEarned(
    userId: string,
    pointsData: {
      amount: number;
      bucket: string;
      reason: string;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'POINTS_EARNED',
      title: 'Pontos ganhos!',
      message: `Você ganhou ${pointsData.amount} pontos em ${pointsData.bucket}`,
      data: {
        amount: pointsData.amount,
        bucket: pointsData.bucket,
        reason: pointsData.reason,
      },
    });
  }

  /**
   * Send redemption expiring notification
   */
  async notifyRedemptionExpiring(
    userId: string,
    redemptionData: {
      id: string;
      rewardName: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'REDEMPTION_EXPIRING',
      title: 'Resgate expirando',
      message: `Seu resgate de "${redemptionData.rewardName}" expira em breve`,
      data: {
        redemptionId: redemptionData.id,
        expiresAt: redemptionData.expiresAt,
      },
    });
  }

  /**
   * Send redemption confirmed notification
   */
  async notifyRedemptionConfirmed(
    userId: string,
    redemptionData: {
      id: string;
      rewardName: string;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'REDEMPTION_CONFIRMED',
      title: 'Resgate confirmado',
      message: `Seu resgate de "${redemptionData.rewardName}" foi confirmado!`,
      data: {
        redemptionId: redemptionData.id,
      },
    });
  }

  /**
   * Send referral completed notification
   */
  async notifyReferralCompleted(
    userId: string,
    referralData: {
      id: string;
      referredName: string;
      pointsEarned: number;
    }
  ): Promise<void> {
    await this.create({
      userId,
      type: 'REFERRAL_COMPLETED',
      title: 'Indicação completada!',
      message: `${referralData.referredName} completou o primeiro agendamento. Você ganhou ${referralData.pointsEarned} pontos!`,
      data: {
        referralId: referralData.id,
        pointsEarned: referralData.pointsEarned,
      },
    });
  }

  /**
   * Get notification statistics (admin)
   */
  async getStatistics(filters?: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): Promise<any> {
    const where: Prisma.NotificationWhereInput = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    const [total, unread, byType] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
    ]);

    const typeDistribution = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total,
      unread,
      read: total - unread,
      typeDistribution,
    };
  }

  /**
   * List all notifications (admin)
   */
  async listAll(filters?: {
    userId?: string;
    isRead?: boolean;
    type?: NotificationType;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        page,
        perPage: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
