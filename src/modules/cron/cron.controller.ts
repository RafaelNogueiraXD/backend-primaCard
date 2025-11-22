import { Request, Response } from 'express';
import prisma from '../../config/database';
import logger from '../../config/logger';

/**
 * Cron endpoints protegidos para Vercel Cron
 * Configurar em vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/v1/cron/expire-redemptions",
 *       "schedule": "0 * * * *"
 *     }
 *   ]
 * }
 */

// Middleware para verificar autenticação do cron
export const verifyCronAuth = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_API_KEY;

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron attempt', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

/**
 * Expirar resgates em HOLD há mais de 24h
 * Executa: A cada hora
 */
export const expireRedemptions = async (req: Request, res: Response) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Buscar resgates expirados
    const expiredRedemptions = await prisma.redemption.findMany({
      where: {
        status: 'HOLD',
        redeemedAt: {
          lt: twentyFourHoursAgo,
        },
      },
      include: {
        reward: true,
        user: true,
      },
    });

    // Processar cada resgate expirado
    for (const redemption of expiredRedemptions) {
      // Cancelar resgate
      await prisma.redemption.update({
        where: { id: redemption.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });

      // Estornar pontos
      await prisma.pointsTransaction.create({
        data: {
          userId: redemption.userId,
          delta: redemption.pointsSpent,
          bucket: redemption.reward.category,
          type: 'REFUND_REDEMPTION',
          description: `Estorno por expiração do resgate: ${redemption.reward.name}`,
          relatedRedemptionId: redemption.id,
        },
      });

      // Incrementar estoque
      await prisma.reward.update({
        where: { id: redemption.rewardId },
        data: {
          stock: { increment: 1 },
        },
      });

      logger.info('Redemption expired and refunded', {
        redemptionId: redemption.id,
        userId: redemption.userId,
        rewardId: redemption.rewardId,
        pointsRefunded: redemption.pointsSpent,
      });
    }

    res.json({
      success: true,
      processed: expiredRedemptions.length,
      message: `Processed ${expiredRedemptions.length} expired redemptions`,
    });
  } catch (error) {
    logger.error('Error expiring redemptions', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Enviar lembretes de consultas
 * Executa: Diariamente às 8h
 */
export const sendAppointmentReminders = async (req: Request, res: Response) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Buscar consultas para amanhã
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        scheduledFor: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
        status: 'SCHEDULED',
      },
      include: {
        patient: true,
        professional: {
          include: {
            user: true,
          },
        },
        procedure: true,
      },
    });

    let remindersSent = 0;

    for (const appointment of upcomingAppointments) {
      // Criar notificação
      await prisma.notification.create({
        data: {
          userId: appointment.patientId,
          type: 'APPOINTMENT_REMINDER',
          title: 'Lembrete: Consulta amanhã',
          message: `Você tem uma consulta amanhã às ${appointment.scheduledFor.toLocaleTimeString(
            'pt-BR',
            { hour: '2-digit', minute: '2-digit' }
          )} com ${appointment.professional.user.firstName}.`,
          data: {
            appointmentId: appointment.id,
            professionalName: `${appointment.professional.user.firstName} ${appointment.professional.user.lastName}`,
            procedureName: appointment.procedure.name,
            scheduledFor: appointment.scheduledFor.toISOString(),
          },
        },
      });

      remindersSent++;

      logger.info('Appointment reminder sent', {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        scheduledFor: appointment.scheduledFor,
      });
    }

    res.json({
      success: true,
      remindersSent,
      message: `Sent ${remindersSent} appointment reminders`,
    });
  } catch (error) {
    logger.error('Error sending appointment reminders', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Limpar tokens expirados
 * Executa: Diariamente às 2h
 */
export const cleanupExpiredTokens = async (req: Request, res: Response) => {
  try {
    const result = await prisma.user.updateMany({
      where: {
        refreshToken: {
          not: null,
        },
      },
      data: {
        refreshToken: null,
      },
    });

    logger.info('Cleanup expired tokens completed', {
      tokensCleared: result.count,
    });

    res.json({
      success: true,
      tokensCleared: result.count,
      message: `Cleared ${result.count} refresh tokens`,
    });
  } catch (error) {
    logger.error('Error cleaning up tokens', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Estatísticas diárias
 * Executa: Diariamente às 23h
 */
export const generateDailyStats = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = {
      date: today.toISOString(),
      appointments: {
        total: await prisma.appointment.count({
          where: {
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
        completed: await prisma.appointment.count({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: today, lt: tomorrow },
          },
        }),
        canceled: await prisma.appointment.count({
          where: {
            status: 'CANCELED',
            updatedAt: { gte: today, lt: tomorrow },
          },
        }),
      },
      users: {
        newPatients: await prisma.user.count({
          where: {
            role: 'PATIENT',
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
      },
      redemptions: {
        confirmed: await prisma.redemption.count({
          where: {
            status: 'CONFIRMED',
            confirmedAt: { gte: today, lt: tomorrow },
          },
        }),
      },
      points: {
        earned: await prisma.pointsTransaction.aggregate({
          where: {
            delta: { gt: 0 },
            createdAt: { gte: today, lt: tomorrow },
          },
          _sum: { delta: true },
        }),
        spent: await prisma.pointsTransaction.aggregate({
          where: {
            delta: { lt: 0 },
            createdAt: { gte: today, lt: tomorrow },
          },
          _sum: { delta: true },
        }),
      },
    };

    logger.info('Daily stats generated', stats);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error generating daily stats', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
