import cron from 'node-cron';
import prisma from '../config/database';
import { PointsService } from '../modules/points/points.service';
import { addDays } from '../utils/dateUtils';
import { config } from '../config';
import logger from '../config/logger';

const pointsService = new PointsService();

/**
 * Job to close evaluation windows and grant points automatically
 * Runs every day at 3 AM
 */
export const closeEvaluationWindows = cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Running job: closeEvaluationWindows');

    const cutoffDate = addDays(new Date(), -config.review.windowDays);

    // Find completed appointments where evaluation window has closed
    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          lte: cutoffDate,
        },
        pointsGrantedAt: null, // Points not yet granted
      },
      include: {
        reviews: true,
      },
    });

    logger.info(`Found ${appointments.length} appointments to process`);

    for (const appointment of appointments) {
      try {
        // Check if professional reviewed the patient (reserved for future logic)
        // const professionalReview = appointment.reviews.find(
        //   r => r.authorId === appointment.professionalId
        // );

        // Grant points regardless (fallback mechanism)
        const snapshot = typeof appointment.procedureSnapshot === 'string' 
          ? JSON.parse(appointment.procedureSnapshot) 
          : appointment.procedureSnapshot as any;

        await pointsService.grantProcedurePoints(
          appointment.id,
          appointment.patientId,
          snapshot,
          appointment.punctualityFlag || undefined
        );

        // Mark points as granted
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { pointsGrantedAt: new Date() },
        });

        logger.info(`Granted points for appointment ${appointment.id}`);
      } catch (error) {
        logger.error(`Error processing appointment ${appointment.id}:`, error);
      }
    }

    logger.info('Job completed: closeEvaluationWindows');
  } catch (error) {
    logger.error('Error in closeEvaluationWindows job:', error);
  }
});

/**
 * Job to expire redemption holds
 * Runs every hour
 */
export const expireRedemptionHolds = cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Running job: expireRedemptionHolds');

    const now = new Date();

    // Find expired holds
    const expiredRedemptions = await prisma.redemption.findMany({
      where: {
        status: 'HOLD',
        expiresAt: {
          lte: now,
        },
      },
      include: { reward: true },
    });

    logger.info(`Found ${expiredRedemptions.length} expired redemptions`);

    for (const redemption of expiredRedemptions) {
      try {
        await prisma.$transaction(async (tx: any) => {
          // Restore stock if applicable
          if (redemption.reward.stockRemaining !== null) {
            await tx.reward.update({
              where: { id: redemption.rewardId },
              data: { stockRemaining: { increment: 1 } },
            });
          }

          // Update status to expired
          await tx.redemption.update({
            where: { id: redemption.id },
            data: { status: 'EXPIRED' },
          });
        });

        // Refund points
        await pointsService.refundPoints(
          redemption.holdBreakdown as any,
          redemption.userId,
          redemption.id
        );

        logger.info(`Expired redemption ${redemption.id} and refunded points`);
      } catch (error) {
        logger.error(`Error expiring redemption ${redemption.id}:`, error);
      }
    }

    logger.info('Job completed: expireRedemptionHolds');
  } catch (error) {
    logger.error('Error in expireRedemptionHolds job:', error);
  }
});

/**
 * Job to auto-complete appointments
 * Runs every 30 minutes
 */
export const autoCompleteAppointments = cron.schedule('*/30 * * * *', async () => {
  try {
    logger.info('Running job: autoCompleteAppointments');

    const now = new Date();
    const buffer = addDays(now, 0, -2, 0); // 2 hours ago

    // Find scheduled appointments that have passed
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        endsAt: {
          lte: buffer,
        },
      },
    });

    logger.info(`Found ${pastAppointments.length} appointments to auto-complete`);

    for (const appointment of pastAppointments) {
      try {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            status: 'AUTO_COMPLETED',
            completedAt: appointment.endsAt,
          },
        });

        logger.info(`Auto-completed appointment ${appointment.id}`);
      } catch (error) {
        logger.error(`Error auto-completing appointment ${appointment.id}:`, error);
      }
    }

    logger.info('Job completed: autoCompleteAppointments');
  } catch (error) {
    logger.error('Error in autoCompleteAppointments job:', error);
  }
});

/**
 * Job to clean up old OTP codes
 * Runs daily at 4 AM
 */
export const cleanupOldOTPs = cron.schedule('0 4 * * *', async () => {
  try {
    logger.info('Running job: cleanupOldOTPs');

    const cutoffDate = addDays(new Date(), -7); // 7 days old

    const result = await prisma.oTPCode.deleteMany({
      where: {
        createdAt: {
          lte: cutoffDate,
        },
      },
    });

    logger.info(`Deleted ${result.count} old OTP codes`);
    logger.info('Job completed: cleanupOldOTPs');
  } catch (error) {
    logger.error('Error in cleanupOldOTPs job:', error);
  }
});

/**
 * Job to clean up expired refresh tokens
 * Runs daily at 5 AM
 */
export const cleanupExpiredTokens = cron.schedule('0 5 * * *', async () => {
  try {
    logger.info('Running job: cleanupExpiredTokens');

    const now = new Date();

    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    logger.info(`Deleted ${result.count} expired refresh tokens`);
    logger.info('Job completed: cleanupExpiredTokens');
  } catch (error) {
    logger.error('Error in cleanupExpiredTokens job:', error);
  }
});

export function startJobs() {
  logger.info('Starting scheduled jobs...');
  
  closeEvaluationWindows.start();
  expireRedemptionHolds.start();
  autoCompleteAppointments.start();
  cleanupOldOTPs.start();
  cleanupExpiredTokens.start();

  logger.info('All scheduled jobs started successfully');
}

export function stopJobs() {
  logger.info('Stopping scheduled jobs...');
  
  closeEvaluationWindows.stop();
  expireRedemptionHolds.stop();
  autoCompleteAppointments.stop();
  cleanupOldOTPs.stop();
  cleanupExpiredTokens.stop();

  logger.info('All scheduled jobs stopped');
}
