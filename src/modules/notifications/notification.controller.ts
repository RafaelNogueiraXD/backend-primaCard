import { Request, Response } from 'express';
import { NotificationService } from './notification.service';
import logger from '../../config/logger';

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * Get user notifications
   */
  async getMyNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;
      const { isRead, type, page, limit } = req.query;

      const filters: any = {};
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (type) filters.type = type as string;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await notificationService.getUserNotifications(
        userId,
        filters
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get notifications' }],
      });
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;

      const count = await notificationService.getUnreadCount(userId);

      res.json({ data: { unreadCount: count } });
    } catch (error: any) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get unread count' }],
      });
    }
  }

  /**
   * Get notification by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.user as any;

      const notification = await notificationService.getById(id, userId);

      res.json({ data: notification });
    } catch (error: any) {
      logger.error('Error getting notification:', error);
      const status = error.message === 'Notification not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to get notification' }],
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.user as any;

      const notification = await notificationService.markAsRead(id, userId);

      res.json({ data: notification });
    } catch (error: any) {
      logger.error('Error marking notification as read:', error);
      const status = error.message === 'Notification not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to mark as read' }],
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;

      const result = await notificationService.markAllAsRead(userId);

      logger.info(`Marked ${result.count} notifications as read for user ${userId}`);
      res.json({ data: result });
    } catch (error: any) {
      logger.error('Error marking all as read:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to mark all as read' }],
      });
    }
  }

  /**
   * Delete notification
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { userId } = req.user as any;

      await notificationService.delete(id, userId);

      logger.info(`Notification deleted: ${id}`);
      res.status(204).send();
    } catch (error: any) {
      logger.error('Error deleting notification:', error);
      const status = error.message === 'Notification not found' ? 404 : 500;
      res.status(status).json({
        errors: [{ message: error.message || 'Failed to delete notification' }],
      });
    }
  }

  /**
   * Delete all notifications
   */
  async deleteAll(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.user as any;

      const result = await notificationService.deleteAll(userId);

      logger.info(`Deleted ${result.count} notifications for user ${userId}`);
      res.json({ data: result });
    } catch (error: any) {
      logger.error('Error deleting all notifications:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to delete all notifications' }],
      });
    }
  }

  /**
   * Get notification statistics (admin)
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, userId } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (userId) filters.userId = userId as string;

      const stats = await notificationService.getStatistics(filters);

      res.json({ data: stats });
    } catch (error: any) {
      logger.error('Error getting notification statistics:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to get statistics' }],
      });
    }
  }

  /**
   * List all notifications (admin)
   */
  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const { userId, isRead, type, page, limit } = req.query;

      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (type) filters.type = type as string;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await notificationService.listAll(filters);

      res.json(result);
    } catch (error: any) {
      logger.error('Error listing notifications:', error);
      res.status(500).json({
        errors: [{ message: 'Failed to list notifications' }],
      });
    }
  }
}

export default new NotificationController();
