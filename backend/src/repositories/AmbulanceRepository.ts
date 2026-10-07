import { IAmbulanceRepository } from './index';
import { Ambulance, AmbulanceStatus } from '../types';
import { prisma, dbService } from '../config/database';
import { AmbulanceStatus as PrismaAmbulanceStatus } from '@prisma/client';

export class AmbulanceRepository implements IAmbulanceRepository {
  private fallbackStore = new Map<string, Ambulance>();
  private idCounter = 1;

  public async findById(id: string): Promise<Ambulance | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.ambulance.findUnique({ where: { id } });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findAll(filter?: Record<string, unknown>): Promise<Ambulance[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.ambulance.findMany({
          where: filter ? (filter as any) : undefined,
        });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback
      }
    }
    let results = Array.from(this.fallbackStore.values());
    if (filter && filter.status) {
      results = results.filter((a) => a.status === filter.status);
    }
    return results;
  }

  public async findAvailable(): Promise<Ambulance[]> {
    return this.findAll({ status: 'AVAILABLE' });
  }

  public async create(item: Partial<Ambulance>): Promise<Ambulance> {
    const id = item.id || `AMB-${Date.now()}-${this.idCounter++}`;
    const now = new Date().toISOString();

    const ambulance: Ambulance = {
      id,
      vehicleNumber: item.vehicleNumber || `AMB-${Date.now()}`,
      driverName: item.driverName || 'UNASSIGNED',
      driverPhone: item.driverPhone || '0000000000',
      status: item.status || 'AVAILABLE',
      currentLocation: item.currentLocation,
      currentIncidentId: item.currentIncidentId,
      destinationHospitalId: item.destinationHospitalId,
      etaSeconds: item.etaSeconds,
      lastUpdated: now,
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.ambulance.create({
          data: {
            id: ambulance.id,
            vehicleNumber: ambulance.vehicleNumber,
            driverName: ambulance.driverName,
            driverPhone: ambulance.driverPhone,
            status: ambulance.status as PrismaAmbulanceStatus,
            latitude: ambulance.currentLocation?.latitude,
            longitude: ambulance.currentLocation?.longitude,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch {
        // Fallback
      }
    }

    this.fallbackStore.set(id, ambulance);
    return ambulance;
  }

  public async update(id: string, item: Partial<Ambulance>): Promise<Ambulance | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Ambulance = {
      ...existing,
      ...item,
      currentLocation: item.currentLocation
        ? { ...existing.currentLocation, ...item.currentLocation }
        : existing.currentLocation,
      lastUpdated: new Date().toISOString(),
    };

    if (dbService.isDbConnected()) {
      try {
        const updateData: any = {};
        if (item.status) updateData.status = item.status as PrismaAmbulanceStatus;
        if (item.currentIncidentId !== undefined) updateData.currentIncidentId = item.currentIncidentId;
        if (item.destinationHospitalId !== undefined) updateData.destinationHospitalId = item.destinationHospitalId;
        if (item.etaSeconds !== undefined) updateData.etaSeconds = item.etaSeconds;
        if (item.currentLocation) {
          updateData.latitude = item.currentLocation.latitude;
          updateData.longitude = item.currentLocation.longitude;
          updateData.lastUpdated = new Date();
        }

        const record = await prisma.ambulance.update({
          where: { id },
          data: updateData,
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
        await prisma.ambulance.delete({ where: { id } });
      } catch {
        // ignore
      }
    }
    return true;
  }

  private mapToDomain(record: any): Ambulance {
    return {
      id: record.id,
      vehicleNumber: record.vehicleNumber,
      driverName: record.driverName,
      driverPhone: record.driverPhone,
      status: record.status,
      currentLocation:
        record.latitude !== null && record.longitude !== null
          ? { latitude: record.latitude, longitude: record.longitude }
          : undefined,
      currentIncidentId: record.currentIncidentId || undefined,
      destinationHospitalId: record.destinationHospitalId || undefined,
      etaSeconds: record.etaSeconds || undefined,
      lastUpdated: record.lastUpdated.toISOString(),
    };
  }
}

export const ambulanceRepository = new AmbulanceRepository();
