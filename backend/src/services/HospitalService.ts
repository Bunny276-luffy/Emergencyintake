import { Hospital, BedReservation, HospitalDecisionDTO, CapacityInfo } from '../types';
import { hospitalRepository } from '../repositories/HospitalRepository';
import { reservationRepository } from '../repositories/ReservationRepository';
import { incidentRepository } from '../repositories/IncidentRepository';
import { transactionManager } from '../repositories/TransactionManager';
import { auditService } from './AuditService';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { validateReservationStatusTransition } from '../utils/lifecycleValidator';
import { webSocketManager } from '../server/websocket';
import { autoDispatchService } from './AutoDispatchService';
import { logger } from '../utils/logger';

export class HospitalService {
  public async getHospitalProfile(hospitalId: string): Promise<Hospital> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital) {
      throw new NotFoundError(`Hospital with ID '${hospitalId}' not found`, {
        source: 'HOSPITAL',
        operation: 'GET_HOSPITAL_PROFILE',
        hospitalId,
      });
    }
    return hospital;
  }

  public async updateHospitalCapacity(
    hospitalId: string,
    capacityInfo: Partial<CapacityInfo>
  ): Promise<Hospital> {
    const existing = await this.getHospitalProfile(hospitalId);

    if (
      (capacityInfo.totalBeds !== undefined && capacityInfo.totalBeds < 0) ||
      (capacityInfo.availableICUBeds !== undefined && capacityInfo.availableICUBeds < 0) ||
      (capacityInfo.availableEmergencyBeds !== undefined && capacityInfo.availableEmergencyBeds < 0)
    ) {
      throw new ValidationError('Bed capacity numbers cannot be negative', {
        source: 'HOSPITAL',
        operation: 'UPDATE_CAPACITY',
        hospitalId,
      });
    }

    const updated = await hospitalRepository.update(hospitalId, {
      capacity: {
        totalBeds: capacityInfo.totalBeds ?? existing.capacity.totalBeds,
        availableICUBeds: capacityInfo.availableICUBeds ?? existing.capacity.availableICUBeds,
        availableEmergencyBeds: capacityInfo.availableEmergencyBeds ?? existing.capacity.availableEmergencyBeds,
        availableVentilators: capacityInfo.availableVentilators ?? existing.capacity.availableVentilators,
        traumaCenterLevel: capacityInfo.traumaCenterLevel ?? existing.capacity.traumaCenterLevel,
        acceptingPatients: capacityInfo.acceptingPatients ?? existing.capacity.acceptingPatients,
      },
    });

    await auditService.logEvent({
      who: `HOSPITAL_${hospitalId}`,
      what: `Hospital updated bed capacity numbers`,
      source: 'HOSPITAL',
      action: 'UPDATE_CAPACITY',
      result: 'SUCCESS',
      hospitalId,
    });

    webSocketManager.broadcastHospitalCapacityChanged({
      hospitalId,
      capacity: updated!.capacity,
    });

    return updated!;
  }

  public async getIncomingReservations(hospitalId: string): Promise<BedReservation[]> {
    await this.getHospitalProfile(hospitalId);
    return await reservationRepository.findAll({ hospitalId });
  }

  public async acceptReservation(
    hospitalId: string,
    reservationId: string
  ): Promise<BedReservation> {
    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation '${reservationId}' not found`, {
        source: 'HOSPITAL',
        operation: 'ACCEPT_RESERVATION',
        hospitalId,
      });
    }

    if (reservation.hospitalId !== hospitalId) {
      throw new ValidationError(`Reservation '${reservationId}' does not belong to hospital '${hospitalId}'`, {
        source: 'HOSPITAL',
        operation: 'ACCEPT_RESERVATION',
        hospitalId,
      });
    }

    validateReservationStatusTransition(reservation.status, 'CONFIRMED');

    // Execute atomic transaction: confirms reservation & decrements bed count
    await transactionManager.executeBedReservationTransaction(
      reservationId,
      hospitalId,
      reservation.bedType as any
    );

    const updated = await reservationRepository.findById(reservationId);

    await auditService.logEvent({
      who: `HOSPITAL_${hospitalId}`,
      what: `Hospital ACCEPTED bed reservation ${reservationId} for incident ${reservation.incidentId}`,
      source: 'HOSPITAL',
      action: 'ACCEPT_RESERVATION',
      result: 'SUCCESS',
      hospitalId,
      incidentId: reservation.incidentId,
    });

    webSocketManager.broadcastReservationDecision(updated!);

    const freshHosp = await hospitalRepository.findById(hospitalId);
    if (freshHosp) {
      webSocketManager.broadcastHospitalCapacityChanged({
        hospitalId,
        capacity: freshHosp.capacity,
      });
    }

    return updated!;
  }

  public async rejectReservation(
    hospitalId: string,
    reservationId: string,
    reason: string
  ): Promise<BedReservation> {
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Mandatory reason is required when rejecting a hospital reservation', {
        source: 'HOSPITAL',
        operation: 'REJECT_RESERVATION',
        hospitalId,
      });
    }

    const reservation = await reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new NotFoundError(`Reservation '${reservationId}' not found`, {
        source: 'HOSPITAL',
        operation: 'REJECT_RESERVATION',
        hospitalId,
      });
    }

    if (reservation.hospitalId !== hospitalId) {
      throw new ValidationError(`Reservation '${reservationId}' does not belong to hospital '${hospitalId}'`, {
        source: 'HOSPITAL',
        operation: 'REJECT_RESERVATION',
        hospitalId,
      });
    }

    validateReservationStatusTransition(reservation.status, 'REJECTED');

    const updated = await reservationRepository.update(reservationId, {
      status: 'REJECTED',
    });

    await auditService.logEvent({
      who: `HOSPITAL_${hospitalId}`,
      what: `Hospital REJECTED bed reservation ${reservationId} for incident ${reservation.incidentId}. Reason: ${reason}`,
      source: 'HOSPITAL',
      action: 'REJECT_RESERVATION',
      result: 'SUCCESS',
      hospitalId,
      incidentId: reservation.incidentId,
      metadata: { rejectionReason: reason },
    });

    webSocketManager.broadcastReservationDecision(updated!);

    // Trigger automatic reroute engine asynchronously when reservation is rejected
    autoDispatchService.executeAutoReroute(reservation.incidentId, hospitalId, `rejected bed reservation: ${reason}`).catch((err) => {
      logger.error(`[AUTO_REROUTE_BG_ERROR] Background auto-reroute failed for ${reservation.incidentId}: ${err.message}`);
    });

    return updated!;
  }

  public async completeAdmission(hospitalId: string, incidentId: string): Promise<void> {
    await this.getHospitalProfile(hospitalId);

    await incidentRepository.update(incidentId, {
      status: 'ARRIVED_AT_HOSPITAL',
    });

    await auditService.logEvent({
      who: `HOSPITAL_${hospitalId}`,
      what: `Hospital completed admission preparation for patient incident ${incidentId}`,
      source: 'HOSPITAL',
      action: 'COMPLETE_ADMISSION',
      result: 'SUCCESS',
      hospitalId,
      incidentId,
    });
  }
}

export const hospitalService = new HospitalService();
