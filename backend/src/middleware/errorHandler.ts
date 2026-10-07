import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { systemErrorRegistry } from '../errors/SystemErrorLogger';
import { ErrorSeverity } from '../errors/ErrorSeverity';
import { HttpStatus } from '../utils/httpStatus';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else {
    appError = new AppError({
      message: err.message || 'Internal Server Error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.ERROR,
      source: 'SYSTEM_CORE',
      service: 'backend-core',
      operation: `${req.method} ${req.path}`,
      details: { stack: err.stack },
    });
  }

  // Record REAL error into SystemErrorRegistry for Admin Command Center tracking
  const systemErrorRecord = systemErrorRegistry.recordAppError(appError);

  logger.error(`[ERROR_HANDLED] Status ${appError.statusCode}: ${appError.message}`, {
    errorId: systemErrorRecord.id,
    severity: appError.severity,
    path: req.originalUrl,
  });

  res.status(appError.statusCode).json({
    success: false,
    error: {
      id: systemErrorRecord.id,
      message: appError.message,
      statusCode: appError.statusCode,
      severity: appError.severity,
      source: appError.source,
      service: appError.service,
      operation: appError.operation,
      details: appError.details,
      timestamp: systemErrorRecord.timestamp,
    },
  });
};
