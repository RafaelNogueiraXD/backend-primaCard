import { Response } from 'express';
import { ApiResponse } from '../types';

export class ResponseHandler {
  static success<T>(res: Response, data: T, meta?: ApiResponse['meta']): Response {
    const response: ApiResponse<T> = { data };
    if (meta) {
      response.meta = meta;
    }
    return res.status(200).json(response);
  }

  static created<T>(res: Response, data: T): Response {
    return res.status(201).json({ data });
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static error(
    res: Response,
    statusCode: number,
    message: string,
    field?: string,
    code?: string
  ): Response {
    return res.status(statusCode).json({
      errors: [{ message, field, code }],
    });
  }

  static badRequest(res: Response, message: string, field?: string): Response {
    return this.error(res, 400, message, field, 'BAD_REQUEST');
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return this.error(res, 401, message, undefined, 'UNAUTHORIZED');
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return this.error(res, 403, message, undefined, 'FORBIDDEN');
  }

  static notFound(res: Response, message = 'Resource not found'): Response {
    return this.error(res, 404, message, undefined, 'NOT_FOUND');
  }

  static conflict(res: Response, message: string): Response {
    return this.error(res, 409, message, undefined, 'CONFLICT');
  }

  static unprocessableEntity(res: Response, errors: Array<{ message: string; field?: string }>): Response {
    return res.status(422).json({ errors });
  }

  static internalError(res: Response, message = 'Internal server error'): Response {
    return this.error(res, 500, message, undefined, 'INTERNAL_ERROR');
  }
}
