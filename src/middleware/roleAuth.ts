import { Request, Response, NextFunction } from 'express';

export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as any;

    if (!user) {
      res.status(401).json({
        errors: [{ message: 'Unauthorized', code: 'UNAUTHORIZED' }],
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        errors: [{ message: 'Forbidden - Insufficient permissions', code: 'FORBIDDEN' }],
      });
      return;
    }

    next();
  };
};
