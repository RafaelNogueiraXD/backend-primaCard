import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ResponseHandler } from '../../utils/responseHandler';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<Response> {
    try {
      const result = await authService.register(req.body);
      return ResponseHandler.created(res, result);
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.badRequest(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return ResponseHandler.success(res, result);
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.unauthorized(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async refresh(req: Request, res: Response): Promise<Response> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refresh(refreshToken);
      return ResponseHandler.success(res, tokens);
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.unauthorized(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async logout(req: Request, res: Response): Promise<Response> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user!.userId, refreshToken);
      return ResponseHandler.noContent(res);
    } catch (error) {
      return ResponseHandler.internalError(res);
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { email } = req.body;
      const message = await authService.requestPasswordReset(email);
      return ResponseHandler.success(res, { message });
    } catch (error) {
      return ResponseHandler.internalError(res);
    }
  }

  async resetPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { email, otp, newPassword } = req.body;
      await authService.resetPassword(email, otp, newPassword);
      return ResponseHandler.success(res, { message: 'Password reset successful' });
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.badRequest(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async verifyOtp(req: Request, res: Response): Promise<Response> {
    try {
      const { otp } = req.body;
      const userId = req.user!.userId;
      await authService.verifyEmail(userId, otp);
      return ResponseHandler.success(res, { message: 'Email verified successfully' });
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.badRequest(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async getMe(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user!.userId;
      const user = await authService.getMe(userId);
      return ResponseHandler.success(res, user);
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.notFound(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }

  async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user!.userId;
      const { firstName, lastName, phone } = req.body;
      const user = await authService.updateProfile(userId, { firstName, lastName, phone });
      return ResponseHandler.success(res, user);
    } catch (error) {
      if (error instanceof Error) {
        return ResponseHandler.badRequest(res, error.message);
      }
      return ResponseHandler.internalError(res);
    }
  }
}
