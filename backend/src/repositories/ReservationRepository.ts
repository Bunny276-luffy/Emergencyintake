import { IReservationRepository } from './index';
import { BedReservation } from '../types';
import { prisma, dbService } from '../config/database';
import { ReservationStatus as PrismaReservationStatus } from '@prisma/client';

export class ReservationRepository implements IReservationRepository {
  private fallbackStore = new Map<string, BedReservation>();
  private idCounter = 1;

  public async findById(id: string): Promise<BedReservation | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.bedReservation.findUnique({ where: { id } });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findAll(filter?: Record<string, unknown>): Promise<BedReservation[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.bedReservation.findMany({
          where: filter ? (filter as any) : undefined,
        });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback
      }
    }
    let results = Array.from(this.fallbackStore.values());
    if (filter && filter.hospitalId) {
      results = results.filter((r) => r.hospitalId === filter.hospitalId);
    }
    if (filter && filter.incidentId) {
      results = results.filter((r) => r.incidentId === filter.incidentId);
    }
    return results;
  }

  public async findByIncidentId(incidentId: string): Promise<BedReservation[]> {
    return this.findAll({ incidentId });
  }

  public async create(item: Partial<BedReservation>): Promise<BedReservation> {
    const id = item.id || `RESV-${Date.now()}-${this.idCounter++}`;
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const reservation: BedReservation = {
      id,
      incidentId: item.incidentId || '',
      hospitalId: item.hospitalId || '',
      bedType: item.bedType || 'EMERGENCY',
      status: item.status || 'PENDING',
      requestedAt: item.requestedAt || now,
      confirmedAt: item.confirmedAt,
      expiresAt: item.expiresAt || expires,
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.bedReservation.create({
          data: {
            id: reservation.id,
            incidentId: reservation.incidentId,
            hospitalId: reservation.hospitalId,
            bedType: reservation.bedType,
            status: reservation.status as PrismaReservationStatus,
            requestedAt: new Date(reservation.requestedAt),
            expiresAt: new Date(reservation.expiresAt),
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch {
        // Fallback
      }
    }

    this.fallbackStore.set(id, reservation);
    return reservation;
  }

  public async update(id: string, item: Partial<BedReservation>): Promise<BedReservation | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: BedReservation = {
      ...existing,
      ...item,
      confirmedAt: item.status === 'CONFIRMED' ? new Date().toISOString() : existing.confirmedAt,
    };

    if (dbService.isDbConnected()) {
      try {
        const updateData: any = {};
        if (item.status) updateData.status = item.status as PrismaReservationStatus;
        if (item.status === 'CONFIRMED') updateData.confirmedAt = new Date();

        const record = await prisma.bedReservation.update({
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
        await prisma.bedReservation.delete({ where: { id } });
      } catch {
        // ignore
      }
    }
    return true;
  }

  private mapToDomain(record: any): BedReservation {
    return {
      id: record.id,
      incidentId: record.incidentId,
      hospitalId: record.hospitalId,
      bedType: record.bedType as any,
      status: record.status,
      requestedAt: record.requestedAt.toISOString(),
      confirmedAt: record.confirmedAt ? record.confirmedAt.toISOString() : undefined,
      expiresAt: record.expiresAt.toISOString(),
    };
  }
}

export const reservationRepository = new ReservationRepository();
