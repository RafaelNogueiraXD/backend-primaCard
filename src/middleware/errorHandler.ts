import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ResponseHandler } from '../utils/responseHandler';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (res.headersSent) {
    return next(err);
  }

  return ResponseHandler.internalError(res, err.message);
};
