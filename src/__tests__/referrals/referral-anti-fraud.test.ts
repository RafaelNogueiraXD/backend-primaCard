/**
 * Referral Anti-Fraud System Tests
 * 
 * Tests for the new referral system that prevents abuse by only awarding
 * points when the referred user completes their first appointment.
 */

jest.mock('../../config/database');

import { ReferralService } from '../../modules/referrals/referral.service';
import { PointsService } from '../../modules/points/points.service';
import { prismaMock, resetAllMocks } from '../setup';

// Mock PointsService
jest.mock('../../modules/points/points.service');

describe('ReferralService - Anti-Fraud System', () => {
  let referralService: ReferralService;
  let mockPointsService: jest.Mocked<PointsService>;

  beforeEach(() => {
    resetAllMocks();
    referralService = new ReferralService();
    mockPointsService = new PointsService() as jest.Mocked<PointsService>;
  });

  describe('checkAndCompleteReferral - Anti-Fraud Logic', () => {
    it('should NOT award points immediately when user registers with referral code', async () => {
      // Arrange: User just registered with referral code
      const referrerId = 'referrer-123';
      const referredId = 'referred-456';

      prismaMock.referral.findMany.mockResolvedValue([
        {
          id: 'referral-1',
          referrerId,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING',
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // No completed appointments yet
      prismaMock.appointment.findFirst.mockResolvedValue(null);

      // Act: Check if referral should be completed
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: Referral should remain PENDING, no points awarded
      expect(prismaMock.referral.update).not.toHaveBeenCalled();
      expect(prismaMock.referral.findMany).toHaveBeenCalledWith({
        where: {
          referredId,
          status: 'PENDING',
        },
      });
    });

    it('should award points ONLY when referred user completes first appointment', async () => {
      // Arrange: User has completed their first appointment
      const referrerId = 'referrer-123';
      const referredId = 'referred-456';
      const referralId = 'referral-1';

      const pendingReferral = {
        id: referralId,
        referrerId,
        referredId,
        referredEmail: 'referred@test.com',
        referredPhone: null,
        status: 'PENDING' as const,
        completedAt: null,
        awardedAt: null,
        ruleVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.referral.findMany.mockResolvedValue([pendingReferral]);

      // User HAS completed an appointment
      prismaMock.appointment.findFirst.mockResolvedValue({
        id: 'appointment-1',
        professionalId: 'prof-1',
        patientId: referredId,
        procedureId: 'proc-1',
        procedureSnapshot: {},
        status: 'COMPLETED',
        startsAt: new Date(),
        endsAt: new Date(),
        location: null,
        createdById: referredId,
        canceledById: null,
        canceledReason: null,
        canceledAt: null,
        checkinAt: null,
        checkoutAt: null,
        arrivalMarkedAt: null,
        punctualityFlag: null,
        completedAt: new Date(),
        pointsGrantedAt: new Date(),
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.referral.findUnique.mockResolvedValue(pendingReferral);

      const updatedReferral = {
        ...pendingReferral,
        status: 'COMPLETED' as const,
        completedAt: new Date(),
        awardedAt: new Date(),
        ruleVersion: '1.0',
      };

      prismaMock.referral.update.mockResolvedValue(updatedReferral);

      // Mock the grantReferralPoints method
      const grantReferralPointsSpy = jest.spyOn(referralService as any, 'complete');

      // Act: Check if referral should be completed
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: Referral should be completed and points awarded
      expect(prismaMock.referral.update).toHaveBeenCalledWith({
        where: { id: referralId },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          awardedAt: expect.any(Date),
          ruleVersion: '1.0',
        },
      });
    });

    it('should NOT award points if user only scheduled but did not complete appointment', async () => {
      // Arrange: User scheduled appointment but status is SCHEDULED (not completed)
      const referrerId = 'referrer-123';
      const referredId = 'referred-456';

      prismaMock.referral.findMany.mockResolvedValue([
        {
          id: 'referral-1',
          referrerId,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING',
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // User has scheduled appointment but NOT completed
      prismaMock.appointment.findFirst.mockResolvedValue(null); // No COMPLETED appointment

      // Act
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: No points should be awarded
      expect(prismaMock.referral.update).not.toHaveBeenCalled();
    });

    it('should NOT award points if appointment was canceled', async () => {
      // Arrange: User's appointment was canceled
      const referrerId = 'referrer-123';
      const referredId = 'referred-456';

      prismaMock.referral.findMany.mockResolvedValue([
        {
          id: 'referral-1',
          referrerId,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING',
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Query looks for COMPLETED appointments only
      prismaMock.appointment.findFirst.mockResolvedValue(null);

      // Act
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: No points should be awarded
      expect(prismaMock.referral.update).not.toHaveBeenCalled();
    });

    it('should NOT award points if user had NO_SHOW', async () => {
      // Arrange: User scheduled but was marked as NO_SHOW
      const referrerId = 'referrer-123';
      const referredId = 'referred-456';

      prismaMock.referral.findMany.mockResolvedValue([
        {
          id: 'referral-1',
          referrerId,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING',
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Only COMPLETED appointments trigger points
      prismaMock.appointment.findFirst.mockResolvedValue(null);

      // Act
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: No points awarded
      expect(prismaMock.referral.update).not.toHaveBeenCalled();
    });

    it('should handle multiple pending referrals for same user (edge case)', async () => {
      // Arrange: User was referred by multiple people (edge case)
      const referrerId1 = 'referrer-111';
      const referrerId2 = 'referrer-222';
      const referredId = 'referred-456';

      const referrals = [
        {
          id: 'referral-1',
          referrerId: referrerId1,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING' as const,
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'referral-2',
          referrerId: referrerId2,
          referredId,
          referredEmail: 'referred@test.com',
          referredPhone: null,
          status: 'PENDING' as const,
          completedAt: null,
          awardedAt: null,
          ruleVersion: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.referral.findMany.mockResolvedValue(referrals);

      // User completed appointment
      prismaMock.appointment.findFirst.mockResolvedValue({
        id: 'appointment-1',
        professionalId: 'prof-1',
        patientId: referredId,
        procedureId: 'proc-1',
        procedureSnapshot: {},
        status: 'COMPLETED',
        startsAt: new Date(),
        endsAt: new Date(),
        location: null,
        createdById: referredId,
        canceledById: null,
        canceledReason: null,
        canceledAt: null,
        checkinAt: null,
        checkoutAt: null,
        arrivalMarkedAt: null,
        punctualityFlag: null,
        completedAt: new Date(),
        pointsGrantedAt: new Date(),
        idempotencyKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.referral.findUnique
        .mockResolvedValueOnce(referrals[0])
        .mockResolvedValueOnce(referrals[1]);

      prismaMock.referral.update
        .mockResolvedValueOnce({ ...referrals[0], status: 'COMPLETED' as const })
        .mockResolvedValueOnce({ ...referrals[1], status: 'COMPLETED' as const });

      // Act
      await referralService.checkAndCompleteReferral(referredId);

      // Assert: Both referrals should be completed
      expect(prismaMock.referral.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('complete - Points Awarding', () => {
    it('should award configured points amount to referrer', async () => {
      // Arrange
      const referrerId = 'referrer-123';
      const referralId = 'referral-1';

      const referral = {
        id: referralId,
        referrerId,
        referredId: 'referred-456',
        referredEmail: 'referred@test.com',
        referredPhone: null,
        status: 'PENDING' as const,
        completedAt: null,
        awardedAt: null,
        ruleVersion: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.referral.findUnique.mockResolvedValue(referral);
      prismaMock.referral.update.mockResolvedValue({
        ...referral,
        status: 'COMPLETED',
        completedAt: new Date(),
        awardedAt: new Date(),
        ruleVersion: '1.0',
      });

      // Act
      await referralService.complete(referralId);

      // Assert: Referral marked as COMPLETED
      expect(prismaMock.referral.update).toHaveBeenCalledWith({
        where: { id: referralId },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          awardedAt: expect.any(Date),
          ruleVersion: '1.0',
        },
      });
    });

    it('should throw error when trying to complete already completed referral', async () => {
      // Arrange: Referral already completed
      const referralId = 'referral-1';

      prismaMock.referral.findUnique.mockResolvedValue({
        id: referralId,
        referrerId: 'referrer-123',
        referredId: 'referred-456',
        referredEmail: 'referred@test.com',
        referredPhone: null,
        status: 'COMPLETED',
        completedAt: new Date(),
        awardedAt: new Date(),
        ruleVersion: '1.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act & Assert
      await expect(referralService.complete(referralId)).rejects.toThrow(
        'Referral already completed or canceled'
      );
    });
  });
});
