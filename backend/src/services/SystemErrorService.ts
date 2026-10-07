import { systemErrorRegistry } from '../errors/SystemErrorLogger';
import { ErrorSeverity, SystemErrorRecord, SystemErrorSource } from '../errors/ErrorSeverity';

export class SystemErrorService {
  /**
   * Retrieves all real recorded system error logs for the Admin Command Center.
   */
  public async getSystemErrors(filter?: {
    severity?: ErrorSeverity;
    source?: SystemErrorSource;
    resolved?: boolean;
  }): Promise<SystemErrorRecord[]> {
    return systemErrorRegistry.getRecordedErrors(filter);
  }

  /**
   * Resolves a recorded error by ID.
   */
  public async resolveError(errorId: string): Promise<boolean> {
    return systemErrorRegistry.resolveError(errorId);
  }
}

export const systemErrorService = new SystemErrorService();
