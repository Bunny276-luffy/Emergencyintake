import { AuditLogEntry, RecordAuditInput } from '../types/audit';
import { logger } from '../utils/logger';
import { auditRepository } from '../repositories/AuditRepository';

export class AuditService {
  private static instance: AuditService;
  private auditLogs: AuditLogEntry[] = [];
  private idCounter = 1;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Record a real audit event in the system audit trail.
   */
  public async logEvent(input: RecordAuditInput): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `AUD-${Date.now()}-${this.idCounter++}`,
      timestamp: new Date().toISOString(),
      who: input.who,
      what: input.what,
      source: input.source,
      action: input.action,
      result: input.result,
      incidentId: input.incidentId,
      ambulanceId: input.ambulanceId,
      hospitalId: input.hospitalId,
      metadata: input.metadata,
    };

    this.auditLogs.push(entry);

    logger.info(`[AUDIT_LOG] [${entry.source}] ${entry.who} -> ${entry.action} (${entry.result})`, {
      auditId: entry.id,
      what: entry.what,
    });

    // Broadcast audit event to Admin Command Center via WebSockets
    try {
      const { webSocketManager } = require('../server/websocket');
      webSocketManager.broadcastAuditEvent(entry);
    } catch {
      // ignore
    }

    // Asynchronously persist to database
    auditRepository.recordLog(entry).catch(() => {});

    return entry;
  }

  /**
   * Query recorded audit logs for Admin Command Center.
   */
  public async getAuditLogs(filter?: {
    who?: string;
    source?: string;
    action?: string;
    result?: 'SUCCESS' | 'FAILURE' | 'PENDING';
    incidentId?: string;
  }): Promise<AuditLogEntry[]> {
    const dbLogs = await auditRepository.queryLogs(filter);
    if (dbLogs && dbLogs.length > 0) {
      return dbLogs;
    }

    let results = [...this.auditLogs];

    if (filter) {
      if (filter.who) results = results.filter((l) => l.who === filter.who);
      if (filter.source) results = results.filter((l) => l.source === filter.source);
      if (filter.action) results = results.filter((l) => l.action === filter.action);
      if (filter.result) results = results.filter((l) => l.result === filter.result);
      if (filter.incidentId) results = results.filter((l) => l.incidentId === filter.incidentId);
    }

    return results;
  }

  public clear(): void {
    this.auditLogs = [];
    this.idCounter = 1;
  }
}

export const auditService = AuditService.getInstance();
