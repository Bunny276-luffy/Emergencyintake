import { IParamedicRepository } from './index';
import { ParamedicReport } from '../types';
import { prisma, dbService } from '../config/database';
import { TriageLevel as PrismaTriageLevel } from '@prisma/client';

export class ParamedicRepository implements IParamedicRepository {
  private fallbackStore = new Map<string, ParamedicReport>();
  private idCounter = 1;

  public async findById(id: string): Promise<ParamedicReport | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.paramedicReport.findUnique({ where: { id } });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findAll(filter?: Record<string, unknown>): Promise<ParamedicReport[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.paramedicReport.findMany({
          where: filter ? (filter as any) : undefined,
          orderBy: { createdAt: 'desc' },
        });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback
      }
    }
    return Array.from(this.fallbackStore.values());
  }

  public async findByIncidentId(incidentId: string): Promise<ParamedicReport[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.paramedicReport.findMany({
          where: { incidentId },
          orderBy: { createdAt: 'desc' },
        });
        if (records.length > 0) {
          return records.map((r) => this.mapToDomain(r));
        }
      } catch {
        // Fallback
      }
    }
    return Array.from(this.fallbackStore.values()).filter((r) => r.incidentId === incidentId);
  }

  public async create(item: Partial<ParamedicReport>): Promise<ParamedicReport> {
    const id = item.id || `REP-${Date.now()}-${this.idCounter++}`;
    const now = new Date().toISOString();

    const report: ParamedicReport = {
      id,
      incidentId: item.incidentId || '',
      paramedicId: item.paramedicId || 'PARAMEDIC_UNIT_1',
      patientConditionSummary: item.patientConditionSummary || '',
      triageLevel: item.triageLevel || 'URGENT_YELLOW',
      vitals: item.vitals || { recordedAt: now },
      voiceReportAudioUrl: item.voiceReportAudioUrl,
      transcriptionText: item.transcriptionText,
      createdAt: now,
      updatedAt: now,
    };

    if (dbService.isDbConnected()) {
      try {
        // Ensure parent paramedic record exists to satisfy foreign key constraint
        if (report.paramedicId) {
          await prisma.paramedic.upsert({
            where: { id: report.paramedicId },
            update: {},
            create: {
              id: report.paramedicId,
              name: 'Field Paramedic Response Unit',
              phone: '+91-9876543220',
              unitNumber: report.paramedicId,
            },
          });
        }

        const record = await prisma.paramedicReport.create({
          data: {
            id: report.id,
            incidentId: report.incidentId,
            paramedicId: report.paramedicId,
            patientConditionSummary: report.patientConditionSummary,
            triageLevel: report.triageLevel as PrismaTriageLevel,
            heartRate: report.vitals.heartRate,
            bloodPressureSystolic: report.vitals.bloodPressureSystolic,
            bloodPressureDiastolic: report.vitals.bloodPressureDiastolic,
            oxygenSaturation: report.vitals.oxygenSaturation,
            respiratoryRate: report.vitals.respiratoryRate,
            temperatureCelsius: report.vitals.temperatureCelsius,
            glasgowComaScale: report.vitals.glasgowComaScale,
            voiceReportAudioUrl: report.voiceReportAudioUrl,
            transcriptionText: report.transcriptionText,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch (err: any) {
        // Fallback to in-memory store
      }
    }

    this.fallbackStore.set(id, report);
    return report;
  }

  public async update(id: string, item: Partial<ParamedicReport>): Promise<ParamedicReport | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: ParamedicReport = {
      ...existing,
      ...item,
      updatedAt: new Date().toISOString(),
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.paramedicReport.update({
          where: { id },
          data: {
            patientConditionSummary: item.patientConditionSummary,
            triageLevel: item.triageLevel ? (item.triageLevel as PrismaTriageLevel) : undefined,
            voiceReportAudioUrl: item.voiceReportAudioUrl,
            transcriptionText: item.transcriptionText,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(id, mapped);
        return mapped;
      } catch {
        // Fallback
      }
    }

    this.fallbackStore.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    this.fallbackStore.delete(id);
    if (dbService.isDbConnected()) {
      try {
        await prisma.paramedicReport.delete({ where: { id } });
      } catch {
        // ignore
      }
    }
    return true;
  }

  private mapToDomain(record: any): ParamedicReport {
    return {
      id: record.id,
      incidentId: record.incidentId,
      paramedicId: record.paramedicId,
      patientConditionSummary: record.patientConditionSummary,
      triageLevel: record.triageLevel,
      vitals: {
        heartRate: record.heartRate || undefined,
        bloodPressureSystolic: record.bloodPressureSystolic || undefined,
        bloodPressureDiastolic: record.bloodPressureDiastolic || undefined,
        oxygenSaturation: record.oxygenSaturation || undefined,
        respiratoryRate: record.respiratoryRate || undefined,
        temperatureCelsius: record.temperatureCelsius || undefined,
        glasgowComaScale: record.glasgowComaScale || undefined,
        recordedAt: record.createdAt.toISOString(),
      },
      voiceReportAudioUrl: record.voiceReportAudioUrl || undefined,
      transcriptionText: record.transcriptionText || undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

export const paramedicRepository = new ParamedicRepository();
