import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/AppError';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`, {
    source: 'API_GATEWAY',
    operation: 'ROUTE_LOOKUP',
    details: { path: req.originalUrl, method: req.method },
  });
  next(error);
};
