/**
 * Notification Service Unit Tests
 * 
 * Tests for notification functionality:
 * - create
 * - getForUser
 * - markAsRead
 * - getUnreadCount
 * - delete
 */

// Mock must come BEFORE importing the service
jest.mock('../../config/database');

import { NotificationService } from '../../modules/notifications/notification.service';
import { 
  prismaMock, 
  resetAllMocks, 
  createMockUser 
} from '../setup';

// Helper to create mock notification
const createMockNotification = (overrides = {}) => ({
  id: 'notification-123',
  userId: 'user-123',
  type: 'APPOINTMENT_REMINDER' as const,
  title: 'Lembrete de Consulta',
  message: 'Sua consulta é amanhã às 10h',
  data: {},
  isRead: false,
  createdAt: new Date(),
  ...overrides,
});

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    resetAllMocks();
    notificationService = new NotificationService();
  });

  describe('create', () => {
    it('should create a notification successfully', async () => {
      // Arrange
      const notificationData = {
        userId: 'user-123',
        type: 'APPOINTMENT_REMINDER' as const,
        title: 'Lembrete de Consulta',
        message: 'Sua consulta é amanhã às 10h',
        data: { appointmentId: 'appointment-123' },
      };

      prismaMock.notification.create.mockResolvedValue(
        createMockNotification(notificationData)
      );

      // Act
      const result = await notificationService.create(notificationData);

      // Assert
      expect(result).toBeDefined();
      expect(result.type).toBe('APPOINTMENT_REMINDER');
      expect(prismaMock.notification.create).toHaveBeenCalled();
    });

    it('should create notification with all types', async () => {
      // Arrange
      const types = [
        'APPOINTMENT_REQUESTED',
        'APPOINTMENT_ACCEPTED',
        'APPOINTMENT_CANCELED',
        'APPOINTMENT_REMINDER',
        'REVIEW_PENDING',
        'POINTS_EARNED',
        'REDEMPTION_EXPIRING',
        'REDEMPTION_CONFIRMED',
        'REFERRAL_COMPLETED',
      ];

      for (const type of types) {
        prismaMock.notification.create.mockResolvedValue(
          createMockNotification({ type })
        );

        // Act
        const result = await notificationService.create({
          userId: 'user-123',
          type: type as any,
          title: 'Test',
          message: 'Test message',
        });

        // Assert
        expect(result.type).toBe(type);
      }
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockNotifications = [
        createMockNotification({ id: 'notif-1' }),
        createMockNotification({ id: 'notif-2' }),
      ];

      prismaMock.notification.findMany.mockResolvedValue(mockNotifications);
      prismaMock.notification.count.mockResolvedValue(2);

      // Act
      const result = await notificationService.getUserNotifications(userId);

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by read status', async () => {
      // Arrange
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(0);

      // Act
      await notificationService.getUserNotifications('user-123', { isRead: false });

      // Assert
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isRead: false,
          }),
        })
      );
    });

    it('should filter by notification type', async () => {
      // Arrange
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(0);

      // Act
      await notificationService.getUserNotifications('user-123', { type: 'POINTS_EARNED' });

      // Assert
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'POINTS_EARNED',
          }),
        })
      );
    });

    it('should order notifications by createdAt desc', async () => {
      // Arrange
      prismaMock.notification.findMany.mockResolvedValue([]);
      prismaMock.notification.count.mockResolvedValue(0);

      // Act
      await notificationService.getUserNotifications('user-123');

      // Assert
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const userId = 'user-123';

      prismaMock.notification.findFirst.mockResolvedValue(
        createMockNotification({ id: notificationId, userId })
      );
      prismaMock.notification.update.mockResolvedValue(
        createMockNotification({ id: notificationId, isRead: true, readAt: new Date() })
      );

      // Act
      const result = await notificationService.markAsRead(notificationId, userId);

      // Assert
      expect(result.isRead).toBe(true);
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });

    it('should throw error when notification not found', async () => {
      // Arrange
      prismaMock.notification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.markAsRead('non-existent', 'user-123'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw error when user is not owner', async () => {
      // Arrange - findFirst with both id and userId returns null if user doesn't match
      prismaMock.notification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.markAsRead('notification-123', 'user-123'))
        .rejects.toThrow('Notification not found');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.notification.updateMany.mockResolvedValue({ count: 5 });

      // Act
      const result = await notificationService.markAllAsRead(userId);

      // Assert
      expect(result.count).toBe(5);
      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.notification.count.mockResolvedValue(3);

      // Act
      const result = await notificationService.getUnreadCount(userId);

      // Assert
      expect(result).toBe(3);
      expect(prismaMock.notification.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      // Arrange
      prismaMock.notification.count.mockResolvedValue(0);

      // Act
      const result = await notificationService.getUnreadCount('user-123');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      // Arrange
      const notificationId = 'notification-123';
      const userId = 'user-123';

      prismaMock.notification.findFirst.mockResolvedValue(
        createMockNotification({ id: notificationId, userId })
      );
      prismaMock.notification.delete.mockResolvedValue(
        createMockNotification({ id: notificationId })
      );

      // Act
      await notificationService.delete(notificationId, userId);

      // Assert
      expect(prismaMock.notification.delete).toHaveBeenCalledWith({
        where: { id: notificationId },
      });
    });

    it('should throw error when notification not found', async () => {
      // Arrange
      prismaMock.notification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.delete('non-existent', 'user-123'))
        .rejects.toThrow('Notification not found');
    });

    it('should throw error when user is not owner', async () => {
      // Arrange - findFirst with both id and userId returns null if user doesn't match
      prismaMock.notification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.delete('notification-123', 'user-123'))
        .rejects.toThrow('Notification not found');
    });
  });

  describe('deleteAll', () => {
    it('should delete all notifications for user', async () => {
      // Arrange
      const userId = 'user-123';

      prismaMock.notification.deleteMany.mockResolvedValue({ count: 10 });

      // Act
      const result = await notificationService.deleteAll(userId);

      // Assert
      expect(result.count).toBe(10);
      expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });
});
