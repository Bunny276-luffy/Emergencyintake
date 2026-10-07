import { AppError, NotImplementedError, ValidationError } from '../src/errors/AppError';
import { systemErrorRegistry } from '../src/errors/SystemErrorLogger';
import { ErrorSeverity } from '../src/errors/ErrorSeverity';
import { auditService } from '../src/services/AuditService';

describe('Centralized Error Architecture & Audit Logger', () => {
  beforeEach(() => {
    systemErrorRegistry.clear();
    auditService.clear();
  });

  it('should record real AppError instances in SystemErrorRegistry', async () => {
    const error = new ValidationError('Invalid patient vitals', {
      source: 'PARAMEDIC_TEAM',
      operation: 'SUBMIT_CLINICAL_REPORT',
      incidentId: 'INC-101',
    });

    const record = systemErrorRegistry.recordAppError(error);

    expect(record.id).toBeDefined();
    expect(record.severity).toBe(ErrorSeverity.WARNING);
    expect(record.source).toBe('PARAMEDIC_TEAM');
    expect(record.operation).toBe('SUBMIT_CLINICAL_REPORT');
    expect(record.incidentId).toBe('INC-101');
    expect(record.resolved).toBe(false);

    const loggedErrors = await systemErrorRegistry.getRecordedErrors();
    expect(loggedErrors.length).toBe(1);
    expect(loggedErrors[0].id).toBe(record.id);
  });

  it('should support resolving recorded errors by Admin', async () => {
    const error = new NotImplementedError('AI Rerouting', {
      source: 'AI_SERVICE',
      operation: 'CALCULATE_REROUTE',
    });

    const record = systemErrorRegistry.recordAppError(error);
    expect(record.resolved).toBe(false);

    const resolved = await systemErrorRegistry.resolveError(record.id);
    expect(resolved).toBe(true);

    const loggedErrors = await systemErrorRegistry.getRecordedErrors();
    const updatedRecord = loggedErrors[0];
    expect(updatedRecord.resolved).toBe(true);
    expect(updatedRecord.resolvedAt).toBeDefined();
  });

  it('should record real audit log entries', async () => {
    const auditEntry = await auditService.logEvent({
      who: 'DISPATCH_OPERATOR_1',
      what: 'Assigned Ambulance AMB-01 to Incident INC-555',
      source: 'DISPATCH_CENTER',
      action: 'ASSIGN_AMBULANCE',
      result: 'SUCCESS',
      incidentId: 'INC-555',
      ambulanceId: 'AMB-01',
    });

    expect(auditEntry.id).toBeDefined();
    expect(auditEntry.who).toBe('DISPATCH_OPERATOR_1');

    const logs = await auditService.getAuditLogs({ incidentId: 'INC-555' });
    expect(logs.length).toBe(1);
    expect(logs[0].ambulanceId).toBe('AMB-01');
  });
});
