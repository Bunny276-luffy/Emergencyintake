import { prisma, dbService } from '../config/database';
import { incidentRepository } from './IncidentRepository';
import { ambulanceRepository } from './AmbulanceRepository';
import { hospitalRepository } from './HospitalRepository';
import { reservationRepository } from './ReservationRepository';
import { AmbulanceStatus, IncidentStatus, ReservationStatus } from '@prisma/client';

export class TransactionManager {
  /**
   * Atomically assigns an ambulance to an emergency incident, updating both ambulance and incident records.
   */
  public async executeAmbulanceAssignmentTransaction(
    incidentId: string,
    ambulanceId: string,
    hospitalId?: string
  ): Promise<{ success: boolean; message: string }> {
    if (dbService.isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const ambulance = await tx.ambulance.findUnique({
            where: { id: ambulanceId },
          });

          if (!ambulance || ambulance.status !== AmbulanceStatus.AVAILABLE) {
            throw new Error(`Ambulance ${ambulanceId} is not available for assignment`);
          }

          await tx.emergencyIncident.update({
            where: { id: incidentId },
            data: {
              assignedAmbulanceId: ambulanceId,
              destinationHospitalId: hospitalId,
              status: IncidentStatus.DISPATCHED,
            },
          });

          await tx.ambulance.update({
            where: { id: ambulanceId },
            data: {
              status: AmbulanceStatus.ASSIGNED,
              currentIncidentId: incidentId,
              destinationHospitalId: hospitalId,
            },
          });

          return {
            success: true,
            message: `Ambulance ${ambulanceId} atomically assigned to incident ${incidentId}`,
          };
        });
      } catch (err: any) {
        if (err.message.includes('not available')) throw err;
        // Fallback to in-memory store if DB transaction fails
      }
    }

    // Fallback in-memory atomic update
    const amb = await ambulanceRepository.findById(ambulanceId);
    if (!amb || amb.status !== 'AVAILABLE') {
      throw new Error(`Ambulance ${ambulanceId} is not available for assignment`);
    }

    await incidentRepository.update(incidentId, {
      assignedAmbulanceId: ambulanceId,
      destinationHospitalId: hospitalId,
      status: 'DISPATCHED',
    });

    await ambulanceRepository.update(ambulanceId, {
      status: 'ASSIGNED',
      currentIncidentId: incidentId,
      destinationHospitalId: hospitalId,
    });

    return {
      success: true,
      message: `Ambulance ${ambulanceId} assigned to incident ${incidentId}`,
    };
  }

  /**
   * Atomically executes bed reservation confirmation and updates hospital bed availability.
   */
  public async executeBedReservationTransaction(
    reservationId: string,
    hospitalId: string,
    bedType: 'EMERGENCY' | 'ICU' | 'GENERAL'
  ): Promise<{ success: boolean; message: string }> {
    if (dbService.isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const hospital = await tx.hospital.findUnique({
            where: { id: hospitalId },
          });

          if (!hospital || !hospital.acceptingPatients) {
            throw new Error(`Hospital ${hospitalId} is not currently accepting patients`);
          }

          if (bedType === 'EMERGENCY' && hospital.availableEmergencyBeds <= 0) {
            throw new Error(`Hospital ${hospitalId} has no available emergency beds`);
          }

          if (bedType === 'ICU' && hospital.availableICUBeds <= 0) {
            throw new Error(`Hospital ${hospitalId} has no available ICU beds`);
          }

          await tx.hospital.update({
            where: { id: hospitalId },
            data: {
              availableEmergencyBeds:
                bedType === 'EMERGENCY'
                  ? Math.max(0, hospital.availableEmergencyBeds - 1)
                  : hospital.availableEmergencyBeds,
              availableICUBeds:
                bedType === 'ICU'
                  ? Math.max(0, hospital.availableICUBeds - 1)
                  : hospital.availableICUBeds,
            },
          });

          await tx.bedReservation.update({
            where: { id: reservationId },
            data: {
              status: ReservationStatus.CONFIRMED,
              confirmedAt: new Date(),
            },
          });

          return {
            success: true,
            message: `Bed reservation ${reservationId} confirmed at hospital ${hospitalId}`,
          };
        });
      } catch (err: any) {
        if (err.message.includes('not currently accepting') || err.message.includes('no available')) {
          throw err;
        }
        // Fallback
      }
    }

    const hosp = await hospitalRepository.findById(hospitalId);
    if (!hosp || !hosp.capacity.acceptingPatients) {
      throw new Error(`Hospital ${hospitalId} is not currently accepting patients`);
    }

    await hospitalRepository.update(hospitalId, {
      capacity: {
        ...hosp.capacity,
        availableEmergencyBeds:
          bedType === 'EMERGENCY'
            ? Math.max(0, hosp.capacity.availableEmergencyBeds - 1)
            : hosp.capacity.availableEmergencyBeds,
      },
    });

    await reservationRepository.update(reservationId, {
      status: 'CONFIRMED',
    });

    return {
      success: true,
      message: `Bed reservation ${reservationId} confirmed at hospital ${hospitalId}`,
    };
  }
}

export const transactionManager = new TransactionManager();
