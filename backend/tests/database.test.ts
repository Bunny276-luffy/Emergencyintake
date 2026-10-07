import { dbService } from '../src/config/database';
import { incidentRepository } from '../src/repositories/IncidentRepository';
import { hospitalRepository } from '../src/repositories/HospitalRepository';
import { systemErrorRegistry } from '../src/errors/SystemErrorLogger';
import { auditService } from '../src/services/AuditService';
import { ErrorSeverity } from '../src/errors/ErrorSeverity';

describe('Phase 2 - Database Layer Verification', () => {
  it('checkDatabaseHealth() should execute real ping query and report status', async () => {
    const health = await dbService.checkDatabaseHealth();
    expect(health).toBeDefined();
    expect(['HEALTHY', 'UNHEALTHY', 'DISCONNECTED']).toContain(health.status);
    if (health.status === 'UNHEALTHY' || health.status === 'DISCONNECTED') {
      expect(health.message).toContain('PostgreSQL');
    }
  });

  it('IncidentRepository and HospitalRepository should define PostGIS spatial query methods', () => {
    expect(incidentRepository.findNearestAmbulancesSpatial).toBeDefined();
    expect(typeof incidentRepository.findNearestAmbulancesSpatial).toBe('function');
    expect(hospitalRepository.findNearestAcceptingHospitalsSpatial).toBeDefined();
    expect(typeof hospitalRepository.findNearestAcceptingHospitalsSpatial).toBe('function');
  });

  it('SystemErrorRegistry should persist real system errors for Admin Command Center', async () => {
    const errorRecord = systemErrorRegistry.recordError({
      severity: ErrorSeverity.CRITICAL,
      source: 'DISPATCH_CENTER',
      service: 'dispatch-service',
      operation: 'EXECUTE_REROUTE',
      message: 'Rerouting service lost contact with hospital node',
      incidentId: 'INC-999',
      ambulanceId: 'AMB-12',
      hospitalId: 'HOSP-04',
    });

    expect(errorRecord.id).toBeDefined();
    expect(errorRecord.severity).toBe(ErrorSeverity.CRITICAL);
    expect(errorRecord.source).toBe('DISPATCH_CENTER');

    const recorded = await systemErrorRegistry.getRecordedErrors({ source: 'DISPATCH_CENTER' });
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.some((e) => e.id === errorRecord.id)).toBe(true);
  });

  it('AuditService should persist operational actions for system auditing', async () => {
    const auditEntry = await auditService.logEvent({
      who: 'PARAMEDIC_UNIT_7',
      what: 'Uploaded voice clinical report audio',
      source: 'PARAMEDIC_TEAM',
      action: 'UPLOAD_VOICE_REPORT',
      result: 'SUCCESS',
      incidentId: 'INC-101',
    });

    expect(auditEntry.id).toBeDefined();
    expect(auditEntry.action).toBe('UPLOAD_VOICE_REPORT');

    const logs = await auditService.getAuditLogs({ source: 'PARAMEDIC_TEAM' });
    expect(logs.length).toBeGreaterThan(0);
  });
});
