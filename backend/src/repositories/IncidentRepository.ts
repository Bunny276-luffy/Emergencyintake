import { IIncidentRepository } from './index';
import { EmergencyIncident, IncidentStatus } from '../types';
import { prisma, dbService } from '../config/database';
import { IncidentPriority as PrismaPriority, IncidentStatus as PrismaStatus } from '@prisma/client';

export class IncidentRepository implements IIncidentRepository {
  private fallbackStore = new Map<string, EmergencyIncident>();
  private idCounter = 1;

  public async findById(id: string): Promise<EmergencyIncident | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.emergencyIncident.findUnique({ 
          where: { id },
          include: { mlTriagePrediction: true, mlETAPrediction: true }
        });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback to in-memory store if DB query fails
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findByIdempotencyKey(key: string): Promise<EmergencyIncident | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.emergencyIncident.findUnique({ 
          where: { idempotencyKey: key },
          include: { mlTriagePrediction: true, mlETAPrediction: true }
        });
        if (record) return this.mapToDomain(record);
      } catch {
        // Handle error
      }
    }
    // Fallback store
    const results = Array.from(this.fallbackStore.values()).filter((i: any) => i.idempotencyKey === key);
    return results.length > 0 ? results[0] : null;
  }

  public async findAll(filter?: Record<string, unknown>): Promise<EmergencyIncident[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.emergencyIncident.findMany({
          where: filter ? (filter as any) : undefined,
          orderBy: { createdAt: 'desc' },
          include: { mlTriagePrediction: true, mlETAPrediction: true }
        });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback to in-memory store
      }
    }
    let results = Array.from(this.fallbackStore.values());
    if (filter && filter.status) {
      if (typeof filter.status === 'object' && (filter.status as any).notIn) {
        const excluded = (filter.status as any).notIn;
        results = results.filter((i) => !excluded.includes(i.status));
      } else if (typeof filter.status === 'string') {
        results = results.filter((i) => i.status === filter.status);
      }
    }
    return results;
  }

  public async findByStatus(status: string): Promise<EmergencyIncident[]> {
    return this.findAll({ status });
  }

  public async create(item: Partial<EmergencyIncident>): Promise<EmergencyIncident> {
    const id = item.id || `INC-${Date.now()}-${this.idCounter++}`;
    const now = new Date().toISOString();

    const incident: EmergencyIncident & { idempotencyKey?: string } = {
      id,
      emergencyType: item.emergencyType || 'GENERAL_EMERGENCY',
      priority: item.priority || 'MEDIUM',
      status: item.status || 'REPORTED',
      location: item.location || { latitude: 0, longitude: 0 },
      description: item.description || '',
      reporterContact: item.reporterContact,
      assignedAmbulanceId: item.assignedAmbulanceId,
      assignedParamedicId: item.assignedParamedicId,
      destinationHospitalId: item.destinationHospitalId,
      idempotencyKey: (item as any).idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.emergencyIncident.create({
          data: {
            id: incident.id,
            emergencyType: incident.emergencyType,
            priority: incident.priority as PrismaPriority,
            status: incident.status as PrismaStatus,
            latitude: incident.location.latitude,
            longitude: incident.location.longitude,
            address: incident.location.address,
            description: incident.description,
            reporterContact: incident.reporterContact,
            idempotencyKey: incident.idempotencyKey,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch (err: any) {
        if (err.code === 'P2002') throw err;
        // Fallback to in-memory store
      }
    }

    this.fallbackStore.set(id, incident);
    return incident;
  }

  public async update(id: string, item: Partial<EmergencyIncident>): Promise<EmergencyIncident | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: EmergencyIncident = {
      ...existing,
      ...item,
      location: item.location ? { ...existing.location, ...item.location } : existing.location,
      updatedAt: new Date().toISOString(),
    };

    if (dbService.isDbConnected()) {
      try {
        const updateData: any = {};
        if (item.status) updateData.status = item.status as PrismaStatus;
        if (item.priority) updateData.priority = item.priority as PrismaPriority;
        if (item.assignedAmbulanceId !== undefined) updateData.assignedAmbulanceId = item.assignedAmbulanceId;
        if (item.assignedParamedicId !== undefined) updateData.assignedParamedicId = item.assignedParamedicId;
        if (item.destinationHospitalId !== undefined) updateData.destinationHospitalId = item.destinationHospitalId;
        if (item.location) {
          updateData.latitude = item.location.latitude;
          updateData.longitude = item.location.longitude;
          if (item.location.address) updateData.address = item.location.address;
        }

        const record = await prisma.emergencyIncident.update({
          where: { id },
          data: updateData,
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(id, mapped);
        return mapped;
      } catch {
        // Fallback to in-memory store
      }
    }

    this.fallbackStore.set(id, updated);
    return updated;
  }

  public async delete(id: string): Promise<boolean> {
    this.fallbackStore.delete(id);
    if (dbService.isDbConnected()) {
      try {
        await prisma.emergencyIncident.delete({ where: { id } });
      } catch {
        // ignore
      }
    }
    return true;
  }

  /**
   * PostGIS spatial query: Finds nearest ambulances within a distance radius.
   */
  public async findNearestAmbulancesSpatial(
    latitude: number,
    longitude: number,
    radiusMeters = 50000
  ): Promise<Array<{ ambulanceId: string; distanceMeters: number }>> {
    if (dbService.isDbConnected()) {
      try {
        const results = await prisma.$queryRaw<
          Array<{ id: string; distance_meters: number }>
        >`
          SELECT id, 
                 ST_DistanceSphere(
                   ST_MakePoint(longitude, latitude), 
                   ST_MakePoint(${longitude}, ${latitude})
                 ) AS distance_meters
          FROM ambulances
          WHERE status = 'AVAILABLE'
            AND ST_DWithin(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${longitude}, ${latitude})::geography,
              ${radiusMeters}
            )
          ORDER BY distance_meters ASC;
        `;

        return results.map((r) => ({
          ambulanceId: r.id,
          distanceMeters: r.distance_meters,
        }));
      } catch {
        // Fallback
      }
    }

    return [];
  }

  private mapToDomain(record: any): EmergencyIncident {
    return {
      id: record.id,
      emergencyType: record.emergencyType,
      priority: record.priority,
      status: record.status,
      location: {
        latitude: record.latitude,
        longitude: record.longitude,
        address: record.address || undefined,
      },
      description: record.description,
      reporterContact: record.reporterContact || undefined,
      assignedAmbulanceId: record.assignedAmbulanceId || undefined,
      assignedParamedicId: record.assignedParamedicId || undefined,
      destinationHospitalId: record.destinationHospitalId || undefined,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      mlTriagePrediction: record.mlTriagePrediction || undefined,
      mlETAPrediction: record.mlETAPrediction || undefined,
      ...(record.idempotencyKey ? { idempotencyKey: record.idempotencyKey } : {}),
    };
  }
}

export const incidentRepository = new IncidentRepository();
