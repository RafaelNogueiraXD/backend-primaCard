import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '../utils/authUtils';
import { ResponseHandler } from '../utils/responseHandler';
import { JWTPayload } from '../types';

// Extend Express Request type
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export const authenticate = (req: Request, res: Response, next: NextFunction): Response | void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseHandler.unauthorized(res, 'No token provided');
    }

    const token = authHeader.substring(7);
    const payload = AuthUtils.verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return ResponseHandler.unauthorized(res, 'Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        return ResponseHandler.unauthorized(res, 'Invalid token');
      }
    }
    return ResponseHandler.unauthorized(res);
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return ResponseHandler.unauthorized(res);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return ResponseHandler.forbidden(res, 'Insufficient permissions');
    }

    next();
  };
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthUtils.verifyAccessToken(token);
      req.user = payload;
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  next();
};
