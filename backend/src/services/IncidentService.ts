import { CreateIncidentDTO, EmergencyIncident, IncidentStatus, Patient } from '../types';
import { incidentRepository } from '../repositories/IncidentRepository';
import { patientRepository } from '../repositories/PatientRepository';
import { auditService } from './AuditService';
import { AppError, NotFoundError, ValidationError } from '../errors/AppError';
import { HttpStatus } from '../utils/httpStatus';
import { validateIncidentStatusTransition } from '../utils/lifecycleValidator';
import { webSocketManager } from '../server/websocket';
import { autoDispatchService } from './AutoDispatchService';
import { logger } from '../utils/logger';

export interface CreatePublicSOSInput extends CreateIncidentDTO {
  patientInfo?: {
    name?: string;
    age?: number;
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    knownMedicalConditions?: string[];
    allergies?: string[];
    bloodType?: string;
  };
}

export class IncidentService {
  public async createPublicSOSIncident(dto: CreatePublicSOSInput): Promise<{
    incident: EmergencyIncident;
    patient?: Patient;
  }> {
    if (!dto.emergencyType || !dto.location || !dto.description) {
      throw new ValidationError('emergencyType, location (latitude, longitude), and description are required', {
        source: 'PUBLIC_SOS',
        operation: 'CREATE_INCIDENT',
      });
    }

    if (
      typeof dto.location.latitude !== 'number' ||
      typeof dto.location.longitude !== 'number'
    ) {
      throw new ValidationError('location.latitude and location.longitude must be valid numbers', {
        source: 'PUBLIC_SOS',
        operation: 'CREATE_INCIDENT',
      });
    }

    if (dto.idempotencyKey) {
      const existing = await incidentRepository.findByIdempotencyKey(dto.idempotencyKey);
      if (existing) {
        if (existing.emergencyType !== dto.emergencyType || existing.description !== dto.description) {
          throw new AppError({
            message: 'Idempotency key reused with different payload',
            statusCode: HttpStatus.CONFLICT,
            severity: 'WARNING' as any,
            source: 'PUBLIC_SOS',
            service: 'incident-service',
            operation: 'CREATE_INCIDENT'
          });
        }
        return { incident: existing };
      }
    }

    try {
      const incident = await incidentRepository.create({
        emergencyType: dto.emergencyType,
        location: dto.location,
        description: dto.description,
        reporterContact: dto.reporterContact,
        status: 'REPORTED',
        priority: 'HIGH',
        idempotencyKey: dto.idempotencyKey
      });

      let patient: Patient | undefined = undefined;
      if (dto.patientInfo) {
        patient = await patientRepository.create({
          incidentId: incident.id,
          name: dto.patientInfo.name,
          age: dto.patientInfo.age,
          gender: dto.patientInfo.gender,
          knownMedicalConditions: dto.patientInfo.knownMedicalConditions,
          allergies: dto.patientInfo.allergies,
          bloodType: dto.patientInfo.bloodType,
        });
      }

      await auditService.logEvent({
        who: dto.reporterContact || 'ANONYMOUS_CITIZEN',
        what: `Public SOS emergency reported: ${dto.emergencyType}`,
        source: 'PUBLIC_SOS',
        action: 'CREATE_INCIDENT',
        result: 'SUCCESS',
        incidentId: incident.id,
      });

      // Broadcast real-time incident event to 108 Dispatch & Admin via WebSockets
      webSocketManager.broadcastIncidentCreated(incident);

      // Trigger Automation-First Dispatch Engine evaluation asynchronously
      if (process.env.DISABLE_AUTO_DISPATCH !== 'true') {
        autoDispatchService.executeAutoDispatch(incident.id).catch((err) => {
          logger.error(`[AUTO_DISPATCH_BG_ERROR] Background auto-dispatch failed for ${incident.id}: ${err.message}`);
        });
      }

      return { incident, patient };
    } catch (err: any) {
      if (err.code === 'P2002' && dto.idempotencyKey) {
        // Unique constraint violation (race condition handled)
        const existing = await incidentRepository.findByIdempotencyKey(dto.idempotencyKey);
        if (existing) {
          if (existing.emergencyType !== dto.emergencyType || existing.description !== dto.description) {
            throw new AppError({
              message: 'Idempotency key reused with different payload',
              statusCode: HttpStatus.CONFLICT,
              severity: 'WARNING' as any,
              source: 'PUBLIC_SOS',
              service: 'incident-service',
              operation: 'CREATE_INCIDENT'
            });
          }
          return { incident: existing };
        }
      }

      if (err instanceof AppError) throw err;
      throw new AppError({
        message: err.message || 'Database error occurred while creating incident',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        severity: 'CRITICAL' as any,
        source: 'PUBLIC_SOS',
        service: 'incident-service',
        operation: 'CREATE_INCIDENT',
        details: { originalError: err.message },
      });
    }
  }

  public async getIncidentById(id: string): Promise<EmergencyIncident> {
    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident with ID '${id}' not found`, {
        source: 'PUBLIC_SOS',
        operation: 'GET_INCIDENT',
        incidentId: id,
      });
    }
    return incident;
  }

  public async getActiveIncidents(): Promise<EmergencyIncident[]> {
    return await incidentRepository.findAll({
      status: { notIn: ['HANDOFF_COMPLETED', 'CANCELLED'] },
    });
  }

  public async updateIncidentStatus(id: string, newStatus: IncidentStatus): Promise<EmergencyIncident> {
    const incident = await this.getIncidentById(id);
    validateIncidentStatusTransition(incident.status, newStatus);

    const updated = await incidentRepository.update(id, { status: newStatus });
    if (!updated) {
      throw new NotFoundError(`Incident with ID '${id}' not found for status update`, {
        source: 'SYSTEM_CORE',
        operation: 'UPDATE_INCIDENT_STATUS',
        incidentId: id,
      });
    }

    await auditService.logEvent({
      who: 'SYSTEM_CORE',
      what: `Incident status updated from ${incident.status} to ${newStatus}`,
      source: 'DISPATCH_CENTER',
      action: 'UPDATE_INCIDENT_STATUS',
      result: 'SUCCESS',
      incidentId: id,
    });

    return updated;
  }
}

export const incidentService = new IncidentService();
