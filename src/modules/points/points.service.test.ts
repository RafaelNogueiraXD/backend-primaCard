import { describe, it, expect, beforeEach } from '@jest/globals';
import { PointsService } from './points.service';
import prisma from '../../config/database';

describe('PointsService - canAfford', () => {
  let pointsService: PointsService;
  const testUserId = 'test-user-id';

  beforeEach(() => {
    pointsService = new PointsService();
  });

  // Helper to mock getBalance
  const mockGetBalance = (balances: { [key: string]: number }) => {
    jest.spyOn(pointsService, 'getBalance').mockResolvedValue(balances);
  };

  describe('Priority Logic', () => {
    it('should use general points first', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 50, [], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 50,
      });
    });

    it('should use general + specific bucket (highest balance first) when general is not enough', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 200, [], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 109,
        whitening: 91, // Uses whitening (1000) before cleaning (30) because it has more points
      });
    });

    it('should skip general when excluded and use highest specific bucket', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 150, [], ['general']);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        whitening: 150, // Uses whitening first because it has more points than cleaning
      });
    });
  });

  describe('Scenario 1: 130 points cost, exclude whitening', () => {
    it('should use 109 general + 21 cleaning', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 130, [], ['whitening']);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 109,
        cleaning: 21,
      });
    });
  });

  describe('Scenario 2: 1000 points cost, exclude cleaning', () => {
    it('should use 109 general + 891 whitening', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 1000, [], ['cleaning']);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 109,
        whitening: 891,
      });
    });
  });

  describe('Scenario 3: Multiple specific buckets', () => {
    it('should use buckets in descending order by balance', async () => {
      mockGetBalance({
        general: 50,
        cleaning: 30,
        whitening: 1000,
        orthodontics: 200,
        implant: 500,
      });

      // Cost 800, exclude general
      const result = await pointsService.canAfford(testUserId, 800, [], ['general']);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        whitening: 800, // 1000 points, use 800 (highest balance used first)
        // implant not used because cost is already covered from whitening
      });
    });
  });

  describe('Scenario 4: Insufficient points', () => {
    it('should return canAfford: false when not enough points', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
      });

      // Exclude general and whitening, only cleaning (30) available
      const result = await pointsService.canAfford(testUserId, 1100, [], ['general', 'whitening']);

      expect(result.canAfford).toBe(false);
      expect(result.breakdown).toBeUndefined();
    });
  });

  describe('Scenario 5: Only general bucket available', () => {
    it('should use only general when specific buckets are excluded', async () => {
      mockGetBalance({
        general: 500,
        cleaning: 30,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 300, [], ['cleaning', 'whitening']);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 300,
      });
    });
  });

  describe('Scenario 6: allowedBuckets filter', () => {
    it('should only use allowed buckets', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 30,
        whitening: 1000,
        orthodontics: 200,
      });

      // Only allow general and cleaning
      const result = await pointsService.canAfford(testUserId, 130, ['general', 'cleaning'], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 109,
        cleaning: 21,
      });
      // whitening and orthodontics should not be used
    });
  });

  describe('Scenario 7: Zero balance buckets', () => {
    it('should skip buckets with zero balance', async () => {
      mockGetBalance({
        general: 109,
        cleaning: 0,
        whitening: 1000,
      });

      const result = await pointsService.canAfford(testUserId, 200, [], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 109,
        whitening: 91, // Skips cleaning because balance is 0
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact cost match with general', async () => {
      mockGetBalance({
        general: 100,
        cleaning: 50,
      });

      const result = await pointsService.canAfford(testUserId, 100, [], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({
        general: 100,
      });
    });

    it('should handle cost of 0', async () => {
      mockGetBalance({
        general: 100,
      });

      const result = await pointsService.canAfford(testUserId, 0, [], []);

      expect(result.canAfford).toBe(true);
      expect(result.breakdown).toEqual({});
    });

    it('should handle empty balances', async () => {
      mockGetBalance({});

      const result = await pointsService.canAfford(testUserId, 100, [], []);

      expect(result.canAfford).toBe(false);
      expect(result.breakdown).toBeUndefined();
    });
  });
});
