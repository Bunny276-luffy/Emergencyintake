import { Ambulance, AmbulanceStatus, EmergencyIncident } from '../types';
import { ambulanceRepository } from '../repositories/AmbulanceRepository';
import { incidentRepository } from '../repositories/IncidentRepository';
import { auditService } from './AuditService';
import { AppError, NotFoundError, ValidationError } from '../errors/AppError';
import { HttpStatus } from '../utils/httpStatus';
import { validateAmbulanceStatusTransition, validateIncidentStatusTransition } from '../utils/lifecycleValidator';
import { webSocketManager } from '../server/websocket';
import { routingService } from './RoutingService';

export class AmbulanceService {
  public async getAmbulanceById(ambulanceId: string): Promise<Ambulance> {
    const ambulance = await ambulanceRepository.findById(ambulanceId);
    if (!ambulance) {
      throw new NotFoundError(`Ambulance with ID '${ambulanceId}' not found`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'GET_AMBULANCE',
        ambulanceId,
      });
    }
    return ambulance;
  }

  public async getAssignment(ambulanceId: string): Promise<{
    ambulance: Ambulance;
    incident?: EmergencyIncident;
  }> {
    const ambulance = await this.getAmbulanceById(ambulanceId);
    let incident: EmergencyIncident | undefined = undefined;

    if (ambulance.currentIncidentId) {
      const found = await incidentRepository.findById(ambulance.currentIncidentId);
      if (found && found.status !== 'HANDOFF_COMPLETED' && found.status !== 'CANCELLED') {
        incident = found;
      }
    }

    // Bidirectional fallback: Check if any active incident has assignedAmbulanceId === ambulanceId
    if (!incident) {
      const activeIncidents = await incidentRepository.findAll({
        assignedAmbulanceId: ambulanceId,
        status: { notIn: ['HANDOFF_COMPLETED', 'CANCELLED'] },
      });
      if (activeIncidents.length > 0) {
        incident = activeIncidents[0];
        // Ensure ambulance record is synchronized
        if (!ambulance.currentIncidentId || ambulance.status === 'AVAILABLE') {
          await ambulanceRepository.update(ambulanceId, {
            status: 'ASSIGNED',
            currentIncidentId: incident.id,
            destinationHospitalId: incident.destinationHospitalId,
          });
          ambulance.status = 'ASSIGNED';
          ambulance.currentIncidentId = incident.id;
          ambulance.destinationHospitalId = incident.destinationHospitalId;
        }
      }
    }

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance requested current assignment`,
      source: 'AMBULANCE_DRIVER',
      action: 'GET_ASSIGNMENT',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: incident?.id || ambulance.currentIncidentId,
    });

    return { ambulance, incident };
  }

  public async updateLocation(
    ambulanceId: string,
    latitude: number,
    longitude: number
  ): Promise<Ambulance> {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new ValidationError('latitude and longitude must be numbers', {
        source: 'AMBULANCE_DRIVER',
        operation: 'UPDATE_LOCATION',
        ambulanceId,
      });
    }

    try {
      // Use routing service to update ETA dynamically
      const res = await routingService.updateAmbulanceETAOnLocationUpdate(ambulanceId, latitude, longitude);
      return res.ambulance;
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      
      // Fallback if routing service fails
      const updated = await ambulanceRepository.update(ambulanceId, {
        currentLocation: { latitude, longitude },
      });

      if (!updated) {
        throw new NotFoundError(`Ambulance '${ambulanceId}' not found for location update`, {
          source: 'AMBULANCE_DRIVER',
          operation: 'UPDATE_LOCATION',
          ambulanceId,
        });
      }

      webSocketManager.broadcastAmbulanceLocation({ ambulanceId, latitude, longitude });

      return updated;
    }
  }

  public async updateStatus(ambulanceId: string, newStatus: AmbulanceStatus): Promise<Ambulance> {
    const ambulance = await this.getAmbulanceById(ambulanceId);
    validateAmbulanceStatusTransition(ambulance.status, newStatus);

    const updated = await ambulanceRepository.update(ambulanceId, { status: newStatus });
    if (!updated) {
      throw new NotFoundError(`Ambulance '${ambulanceId}' not found for status update`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'UPDATE_STATUS',
        ambulanceId,
      });
    }

    webSocketManager.broadcastAmbulanceStatus({
      ambulanceId,
      status: newStatus,
      incidentId: ambulance.currentIncidentId,
      hospitalId: ambulance.destinationHospitalId,
    });

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance status updated to ${newStatus}`,
      source: 'AMBULANCE_DRIVER',
      action: 'UPDATE_STATUS',
      result: 'SUCCESS',
      ambulanceId,
    });

    return updated;
  }

  public async acknowledgeAssignment(ambulanceId: string): Promise<Ambulance> {
    const ambulance = await this.getAmbulanceById(ambulanceId);
    if (!ambulance.currentIncidentId) {
      throw new ValidationError(`Ambulance '${ambulanceId}' has no active assignment to acknowledge`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'ACKNOWLEDGE_ASSIGNMENT',
        ambulanceId,
      });
    }

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance driver acknowledged assignment for incident ${ambulance.currentIncidentId}`,
      source: 'AMBULANCE_DRIVER',
      action: 'ACKNOWLEDGE_ASSIGNMENT',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: ambulance.currentIncidentId,
    });

    return ambulance;
  }

  public async reportPatientArrival(ambulanceId: string): Promise<EmergencyIncident> {
    const { ambulance, incident } = await this.getAssignment(ambulanceId);
    if (!incident) {
      throw new ValidationError(`Ambulance '${ambulanceId}' has no active incident to update`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'REPORT_PATIENT_ARRIVAL',
        ambulanceId,
      });
    }

    validateIncidentStatusTransition(incident.status, 'PATIENT_PICKED_UP');
    const updatedIncident = await incidentRepository.update(incident.id, { status: 'PATIENT_PICKED_UP' });

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance reported arrival at patient scene for incident ${incident.id}`,
      source: 'AMBULANCE_DRIVER',
      action: 'REPORT_PATIENT_ARRIVAL',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: incident.id,
    });

    return updatedIncident!;
  }

  public async reportPatientDeparture(ambulanceId: string): Promise<EmergencyIncident> {
    const { ambulance, incident } = await this.getAssignment(ambulanceId);
    if (!incident) {
      throw new ValidationError(`Ambulance '${ambulanceId}' has no active incident to update`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'REPORT_PATIENT_DEPARTURE',
        ambulanceId,
      });
    }

    validateIncidentStatusTransition(incident.status, 'TRANSPORTING');
    const updatedIncident = await incidentRepository.update(incident.id, { status: 'TRANSPORTING' });

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance departed patient scene transporting patient to hospital`,
      source: 'AMBULANCE_DRIVER',
      action: 'REPORT_PATIENT_DEPARTURE',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: incident.id,
    });

    return updatedIncident!;
  }

  public async reportHospitalArrival(ambulanceId: string): Promise<EmergencyIncident> {
    const { ambulance, incident } = await this.getAssignment(ambulanceId);
    if (!incident) {
      throw new ValidationError(`Ambulance '${ambulanceId}' has no active incident to update`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'REPORT_HOSPITAL_ARRIVAL',
        ambulanceId,
      });
    }

    validateIncidentStatusTransition(incident.status, 'ARRIVED_AT_HOSPITAL');
    const updatedIncident = await incidentRepository.update(incident.id, { status: 'ARRIVED_AT_HOSPITAL' });

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Ambulance arrived at destination hospital for incident ${incident.id}`,
      source: 'AMBULANCE_DRIVER',
      action: 'REPORT_HOSPITAL_ARRIVAL',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: incident.id,
    });

    return updatedIncident!;
  }

  public async completeHandoff(ambulanceId: string): Promise<{
    ambulance: Ambulance;
    incident: EmergencyIncident;
  }> {
    const { ambulance, incident } = await this.getAssignment(ambulanceId);
    if (!incident) {
      throw new ValidationError(`Ambulance '${ambulanceId}' has no active incident to complete handoff`, {
        source: 'AMBULANCE_DRIVER',
        operation: 'COMPLETE_HANDOFF',
        ambulanceId,
      });
    }

    validateIncidentStatusTransition(incident.status, 'HANDOFF_COMPLETED');
    validateAmbulanceStatusTransition(ambulance.status, 'AVAILABLE');

    // Update incident to HANDOFF_COMPLETED
    const updatedIncident = await incidentRepository.update(incident.id, { status: 'HANDOFF_COMPLETED' });

    // Release ambulance back to AVAILABLE status in database
    const updatedAmbulance = await ambulanceRepository.update(ambulanceId, {
      status: 'AVAILABLE',
      currentIncidentId: null as any,
      destinationHospitalId: null as any,
      etaSeconds: null as any,
    });

    await auditService.logEvent({
      who: `AMBULANCE_${ambulanceId}`,
      what: `Completed patient handoff at hospital. Ambulance is now AVAILABLE for next emergency.`,
      source: 'AMBULANCE_DRIVER',
      action: 'COMPLETE_HANDOFF',
      result: 'SUCCESS',
      ambulanceId,
      incidentId: incident.id,
    });

    webSocketManager.broadcastHandoffCompleted({
      incidentId: incident.id,
      ambulanceId,
      hospitalId: incident.destinationHospitalId,
    });

    return { ambulance: updatedAmbulance!, incident: updatedIncident! };
  }
}

export const ambulanceService = new AmbulanceService();
