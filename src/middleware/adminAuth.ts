import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ResponseHandler } from '../utils/responseHandler';

export const adminAuth = (req: Request, res: Response, next: NextFunction): Response | void => {
  const apiKey = req.headers['x-admin-api-key'];

  if (!apiKey || apiKey !== config.adminApiKey) {
    return ResponseHandler.forbidden(res, 'Invalid admin API key');
  }

  next();
};
