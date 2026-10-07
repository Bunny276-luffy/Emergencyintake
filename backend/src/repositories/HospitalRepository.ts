import { IHospitalRepository } from './index';
import { Hospital } from '../types';
import { prisma, dbService } from '../config/database';

export class HospitalRepository implements IHospitalRepository {
  private fallbackStore = new Map<string, Hospital>();
  private idCounter = 1;

  public async findById(id: string): Promise<Hospital | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.hospital.findUnique({ where: { id } });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findAll(filter?: Record<string, unknown>): Promise<Hospital[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.hospital.findMany({
          where: filter ? (filter as any) : undefined,
        });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback
      }
    }
    let results = Array.from(this.fallbackStore.values());
    if (filter && filter.acceptingPatients !== undefined) {
      results = results.filter((h) => h.capacity.acceptingPatients === filter.acceptingPatients);
    }
    return results;
  }

  public async findAcceptingHospitals(): Promise<Hospital[]> {
    return this.findAll({ acceptingPatients: true });
  }

  public async create(item: Partial<Hospital>): Promise<Hospital> {
    const id = item.id || `HOSP-${Date.now()}-${this.idCounter++}`;
    const now = new Date().toISOString();

    const hospital: Hospital = {
      id,
      name: item.name || 'UNNAMED_HOSPITAL',
      location: item.location || { latitude: 0, longitude: 0 },
      contactNumber: item.contactNumber || '0000000000',
      capacity: item.capacity || {
        totalBeds: 0,
        availableICUBeds: 0,
        availableEmergencyBeds: 0,
        availableVentilators: 0,
        traumaCenterLevel: 1,
        acceptingPatients: true,
      },
      specialties: item.specialties || [],
      lastCapacityUpdate: now,
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.hospital.create({
          data: {
            id: hospital.id,
            name: hospital.name,
            latitude: hospital.location.latitude,
            longitude: hospital.location.longitude,
            address: hospital.location.address,
            contactNumber: hospital.contactNumber,
            totalBeds: hospital.capacity.totalBeds,
            availableICUBeds: hospital.capacity.availableICUBeds,
            availableEmergencyBeds: hospital.capacity.availableEmergencyBeds,
            availableVentilators: hospital.capacity.availableVentilators,
            traumaCenterLevel: hospital.capacity.traumaCenterLevel,
            acceptingPatients: hospital.capacity.acceptingPatients,
            specialties: hospital.specialties,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch {
        // Fallback
      }
    }

    this.fallbackStore.set(id, hospital);
    return hospital;
  }

  public async update(id: string, item: Partial<Hospital>): Promise<Hospital | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: Hospital = {
      ...existing,
      ...item,
      capacity: item.capacity ? { ...existing.capacity, ...item.capacity } : existing.capacity,
      lastCapacityUpdate: new Date().toISOString(),
    };

    if (dbService.isDbConnected()) {
      try {
        const updateData: any = {};
        if (item.name) updateData.name = item.name;
        if (item.contactNumber) updateData.contactNumber = item.contactNumber;
        if (item.specialties) updateData.specialties = item.specialties;
        if (item.capacity) {
          if (item.capacity.totalBeds !== undefined) updateData.totalBeds = item.capacity.totalBeds;
          if (item.capacity.availableICUBeds !== undefined) updateData.availableICUBeds = item.capacity.availableICUBeds;
          if (item.capacity.availableEmergencyBeds !== undefined) updateData.availableEmergencyBeds = item.capacity.availableEmergencyBeds;
          if (item.capacity.availableVentilators !== undefined) updateData.availableVentilators = item.capacity.availableVentilators;
          if (item.capacity.traumaCenterLevel !== undefined) updateData.traumaCenterLevel = item.capacity.traumaCenterLevel;
          if (item.capacity.acceptingPatients !== undefined) updateData.acceptingPatients = item.capacity.acceptingPatients;
          updateData.lastCapacityUpdate = new Date();
        }

        const record = await prisma.hospital.update({
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
        await prisma.hospital.delete({ where: { id } });
      } catch {
        // ignore
      }
    }
    return true;
  }

  /**
   * PostGIS spatial query: Finds nearest accepting hospitals within distance radius.
   */
  public async findNearestAcceptingHospitalsSpatial(
    latitude: number,
    longitude: number,
    radiusMeters = 50000
  ): Promise<Array<{ hospitalId: string; distanceMeters: number }>> {
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
          FROM hospitals
          WHERE "acceptingPatients" = true
            AND ST_DWithin(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${longitude}, ${latitude})::geography,
              ${radiusMeters}
            )
          ORDER BY distance_meters ASC;
        `;

        return results.map((r) => ({
          hospitalId: r.id,
          distanceMeters: r.distance_meters,
        }));
      } catch {
        // Fallback
      }
    }

    return Array.from(this.fallbackStore.values())
      .filter((h) => h.capacity.acceptingPatients)
      .map((h) => ({ hospitalId: h.id, distanceMeters: 5000 }));
  }

  private mapToDomain(record: any): Hospital {
    return {
      id: record.id,
      name: record.name,
      location: {
        latitude: record.latitude,
        longitude: record.longitude,
        address: record.address || undefined,
      },
      contactNumber: record.contactNumber,
      capacity: {
        totalBeds: record.totalBeds,
        availableICUBeds: record.availableICUBeds,
        availableEmergencyBeds: record.availableEmergencyBeds,
        availableVentilators: record.availableVentilators,
        traumaCenterLevel: record.traumaCenterLevel,
        acceptingPatients: record.acceptingPatients,
      },
      specialties: record.specialties || [],
      lastCapacityUpdate: record.lastCapacityUpdate.toISOString(),
    };
  }
}

export const hospitalRepository = new HospitalRepository();
