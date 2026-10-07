import { IncidentStatus, AmbulanceStatus, ReservationStatus } from '../types';
import { ValidationError } from '../errors/AppError';

const VALID_INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['PARAMEDIC_EN_ROUTE', 'PATIENT_PICKED_UP', 'CANCELLED'],
  PARAMEDIC_EN_ROUTE: ['PATIENT_PICKED_UP', 'TRANSPORTING', 'CANCELLED'],
  PATIENT_PICKED_UP: ['TRANSPORTING', 'ARRIVED_AT_HOSPITAL', 'CANCELLED'],
  TRANSPORTING: ['ARRIVED_AT_HOSPITAL', 'CANCELLED'],
  ARRIVED_AT_HOSPITAL: ['HANDOFF_COMPLETED', 'CANCELLED'],
  HANDOFF_COMPLETED: [],
  CANCELLED: [],
};

const VALID_AMBULANCE_TRANSITIONS: Record<AmbulanceStatus, AmbulanceStatus[]> = {
  AVAILABLE: ['ASSIGNED', 'OUT_OF_SERVICE', 'MAINTENANCE'],
  ASSIGNED: ['EN_ROUTE', 'AVAILABLE', 'OUT_OF_SERVICE'],
  EN_ROUTE: ['AVAILABLE', 'OUT_OF_SERVICE'],
  OUT_OF_SERVICE: ['AVAILABLE', 'MAINTENANCE'],
  MAINTENANCE: ['AVAILABLE'],
};

const VALID_RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'EXPIRED', 'COMPLETED'],
  CONFIRMED: ['COMPLETED', 'EXPIRED'],
  REJECTED: [],
  EXPIRED: [],
  COMPLETED: [],
};

export const validateIncidentStatusTransition = (
  currentStatus: IncidentStatus,
  newStatus: IncidentStatus
): void => {
  if (currentStatus === newStatus) return;
  const allowed = VALID_INCIDENT_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Invalid incident status transition from '${currentStatus}' to '${newStatus}'`,
      {
        operation: 'INCIDENT_STATUS_TRANSITION',
        details: { currentStatus, newStatus, allowedTransitions: allowed },
      }
    );
  }
};

export const validateAmbulanceStatusTransition = (
  currentStatus: AmbulanceStatus,
  newStatus: AmbulanceStatus
): void => {
  if (currentStatus === newStatus) return;
  const allowed = VALID_AMBULANCE_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Invalid ambulance status transition from '${currentStatus}' to '${newStatus}'`,
      {
        operation: 'AMBULANCE_STATUS_TRANSITION',
        details: { currentStatus, newStatus, allowedTransitions: allowed },
      }
    );
  }
};

export const validateReservationStatusTransition = (
  currentStatus: ReservationStatus,
  newStatus: ReservationStatus
): void => {
  if (currentStatus === newStatus) return;
  const allowed = VALID_RESERVATION_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Invalid reservation status transition from '${currentStatus}' to '${newStatus}'`,
      {
        operation: 'RESERVATION_STATUS_TRANSITION',
        details: { currentStatus, newStatus, allowedTransitions: allowed },
      }
    );
  }
};
