import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { ResponseHandler } from '../../utils/responseHandler';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await this.userService.getProfile(userId);
      ResponseHandler.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { firstName, lastName, phone } = req.body;
      const user = await this.userService.updateProfile(userId, {
        firstName,
        lastName,
        phone,
      });
      ResponseHandler.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      await this.userService.changePassword(userId, currentPassword, newPassword);
      ResponseHandler.success(res, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await this.userService.deleteAccount(userId);
      ResponseHandler.success(res, { message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getPointsBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const balance = await this.userService.getPointsBalance(userId);
      ResponseHandler.success(res, balance);
    } catch (error) {
      next(error);
    }
  }

  async getPointsHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { bucket, cause, page, perPage } = req.query;
      
      const result = await this.userService.getPointsHistory(userId, {
        bucket: bucket as string,
        cause: cause as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, startDate, endDate, page, perPage } = req.query;
      
      const result = await this.userService.getMyAppointments(userId, {
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getMyRedemptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, page, perPage } = req.query;
      
      const result = await this.userService.getMyRedemptions(userId, {
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { isRead, type, page, perPage } = req.query;
      
      const result = await this.userService.getNotifications(userId, {
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        type: type as string,
        page: page ? parseInt(page as string) : undefined,
        perPage: perPage ? parseInt(perPage as string) : undefined,
      });
      
      ResponseHandler.success(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  }

  async markNotificationAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { notificationId } = req.params;
      const notification = await this.userService.markNotificationAsRead(userId, notificationId);
      ResponseHandler.success(res, notification);
    } catch (error) {
      next(error);
    }
  }

  async markAllNotificationsAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await this.userService.markAllNotificationsAsRead(userId);
      ResponseHandler.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}
