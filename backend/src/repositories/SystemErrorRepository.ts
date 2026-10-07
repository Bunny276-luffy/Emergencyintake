import { SystemErrorRecord, ErrorSeverity, SystemErrorSource } from '../errors/ErrorSeverity';
import { prisma, dbService } from '../config/database';
import { ErrorSeverity as PrismaSeverity, SystemErrorSource as PrismaSource } from '@prisma/client';

export interface ISystemErrorRepository {
  recordError(record: SystemErrorRecord): Promise<SystemErrorRecord>;
  getRecordedErrors(filter?: {
    severity?: ErrorSeverity;
    source?: SystemErrorSource;
    resolved?: boolean;
  }): Promise<SystemErrorRecord[]>;
  resolveError(errorId: string): Promise<boolean>;
}

export class SystemErrorRepository implements ISystemErrorRepository {
  public async recordError(record: SystemErrorRecord): Promise<SystemErrorRecord> {
    if (!dbService.isDbConnected()) {
      return record;
    }
    try {
      const created = await prisma.systemErrorRecord.create({
        data: {
          id: record.id,
          timestamp: new Date(record.timestamp),
          severity: record.severity as PrismaSeverity,
          source: record.source as PrismaSource,
          service: record.service,
          operation: record.operation,
          message: record.message,
          details: record.details ? (record.details as any) : undefined,
          incidentId: record.incidentId,
          ambulanceId: record.ambulanceId,
          hospitalId: record.hospitalId,
          resolved: record.resolved,
          resolvedAt: record.resolvedAt ? new Date(record.resolvedAt) : undefined,
        },
      });
      return this.mapToDomain(created);
    } catch {
      return record;
    }
  }

  public async getRecordedErrors(filter?: {
    severity?: ErrorSeverity;
    source?: SystemErrorSource;
    resolved?: boolean;
  }): Promise<SystemErrorRecord[]> {
    if (!dbService.isDbConnected()) {
      return [];
    }
    try {
      const records = await prisma.systemErrorRecord.findMany({
        where: {
          severity: filter?.severity ? (filter.severity as PrismaSeverity) : undefined,
          source: filter?.source ? (filter.source as PrismaSource) : undefined,
          resolved: filter?.resolved !== undefined ? filter.resolved : undefined,
        },
        orderBy: { timestamp: 'desc' },
      });
      return records.map((r) => this.mapToDomain(r));
    } catch {
      return [];
    }
  }

  public async resolveError(errorId: string): Promise<boolean> {
    if (!dbService.isDbConnected()) {
      return false;
    }
    try {
      await prisma.systemErrorRecord.update({
        where: { id: errorId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  private mapToDomain(record: any): SystemErrorRecord {
    return {
      id: record.id,
      timestamp: record.timestamp.toISOString(),
      severity: record.severity as ErrorSeverity,
      source: record.source as SystemErrorSource,
      service: record.service,
      operation: record.operation,
      message: record.message,
      details: record.details ? (record.details as Record<string, unknown>) : undefined,
      incidentId: record.incidentId || undefined,
      ambulanceId: record.ambulanceId || undefined,
      hospitalId: record.hospitalId || undefined,
      resolved: record.resolved,
      resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : undefined,
    };
  }
}

export const systemErrorRepository = new SystemErrorRepository();
