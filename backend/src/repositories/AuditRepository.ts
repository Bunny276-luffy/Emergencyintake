import { AuditLogEntry } from '../types';
import { prisma, dbService } from '../config/database';

export class AuditRepository {
  public async recordLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
    if (!dbService.isDbConnected()) {
      return entry;
    }
    try {
      const record = await prisma.auditLogEntry.create({
        data: {
          id: entry.id,
          timestamp: new Date(entry.timestamp),
          who: entry.who,
          what: entry.what,
          source: entry.source,
          action: entry.action,
          result: entry.result,
          incidentId: entry.incidentId,
          ambulanceId: entry.ambulanceId,
          hospitalId: entry.hospitalId,
          metadata: entry.metadata ? (entry.metadata as any) : undefined,
        },
      });
      return this.mapToDomain(record);
    } catch {
      return entry;
    }
  }

  public async queryLogs(filter?: {
    who?: string;
    source?: string;
    action?: string;
    result?: 'SUCCESS' | 'FAILURE' | 'PENDING';
    incidentId?: string;
  }): Promise<AuditLogEntry[]> {
    if (!dbService.isDbConnected()) {
      return [];
    }
    try {
      const records = await prisma.auditLogEntry.findMany({
        where: {
          who: filter?.who,
          source: filter?.source,
          action: filter?.action,
          result: filter?.result,
          incidentId: filter?.incidentId,
        },
        orderBy: { timestamp: 'desc' },
      });
      return records.map((r) => this.mapToDomain(r));
    } catch {
      return [];
    }
  }

  private mapToDomain(record: any): AuditLogEntry {
    return {
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      who: record.who,
      what: record.what,
      source: record.source,
      action: record.action,
      result: record.result as any,
      incidentId: record.incidentId || undefined,
      ambulanceId: record.ambulanceId || undefined,
      hospitalId: record.hospitalId || undefined,
      metadata: record.metadata ? (record.metadata as Record<string, unknown>) : undefined,
    };
  }
}

export const auditRepository = new AuditRepository();
