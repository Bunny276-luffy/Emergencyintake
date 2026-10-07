import { HttpStatus, HttpStatusCode } from '../utils/httpStatus';
import { ErrorSeverity, SystemErrorSource } from './ErrorSeverity';

export interface AppErrorOptions {
  message: string;
  statusCode?: HttpStatusCode;
  severity?: ErrorSeverity;
  source?: SystemErrorSource;
  service?: string;
  operation?: string;
  details?: Record<string, unknown>;
  incidentId?: string;
  ambulanceId?: string;
  hospitalId?: string;
}

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly severity: ErrorSeverity;
  public readonly source: SystemErrorSource;
  public readonly service: string;
  public readonly operation: string;
  public readonly details?: Record<string, unknown>;
  public readonly incidentId?: string;
  public readonly ambulanceId?: string;
  public readonly hospitalId?: string;
  public readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = options.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.source = options.source || 'SYSTEM_CORE';
    this.service = options.service || 'backend-core';
    this.operation = options.operation || 'unknown_operation';
    this.details = options.details;
    this.incidentId = options.incidentId;
    this.ambulanceId = options.ambulanceId;
    this.hospitalId = options.hospitalId;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', options?: Partial<AppErrorOptions>) {
    super({
      message,
      statusCode: HttpStatus.NOT_FOUND,
      severity: ErrorSeverity.WARNING,
      ...options,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters', options?: Partial<AppErrorOptions>) {
    super({
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      severity: ErrorSeverity.WARNING,
      ...options,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(featureName: string, options?: Partial<AppErrorOptions>) {
    super({
      message: `Operation '${featureName}' depends on later implementation phase.`,
      statusCode: HttpStatus.NOT_IMPLEMENTED,
      severity: ErrorSeverity.INFO,
      details: { feature: featureName, phase: 'Phase 2+' },
      ...options,
    });
  }
}

export class CriticalSystemError extends AppError {
  constructor(message: string, options?: Partial<AppErrorOptions>) {
    super({
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.CRITICAL,
      ...options,
    });
  }
}
