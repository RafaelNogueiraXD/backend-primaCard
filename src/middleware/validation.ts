import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ResponseHandler } from '../utils/responseHandler';

export const validate = (req: Request, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      message: err.msg,
      field: 'type' in err && err.type === 'field' ? err.path : undefined,
    }));

    return ResponseHandler.unprocessableEntity(res, formattedErrors);
  }

  next();
};
