import {
  DispatchAssignmentRequest,
  DispatchRerouteRequest,
  EmergencyIncident,
  Ambulance,
  Hospital,
  BedReservation,
  AuditLogEntry,
} from '../types';
import { transactionManager } from '../repositories/TransactionManager';
import { incidentRepository } from '../repositories/IncidentRepository';
import { ambulanceRepository } from '../repositories/AmbulanceRepository';
import { hospitalRepository } from '../repositories/HospitalRepository';
import { reservationRepository } from '../repositories/ReservationRepository';
import { auditService } from './AuditService';
import { AppError, NotFoundError, ValidationError } from '../errors/AppError';
import { HttpStatus } from '../utils/httpStatus';
import { webSocketManager } from '../server/websocket';
import { MLService } from './MLService';
import { prisma } from '../config/database';

export class DispatchService {
  public async listActiveIncidents(): Promise<EmergencyIncident[]> {
    return await incidentRepository.findAll({
      status: { notIn: ['HANDOFF_COMPLETED', 'CANCELLED'] },
    });
  }

  public async getIncidentDetails(id: string): Promise<{
    incident: EmergencyIncident;
    assignedAmbulance?: Ambulance;
    destinationHospital?: Hospital;
  }> {
    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident '${id}' not found`, {
        source: 'DISPATCH_CENTER',
        operation: 'GET_INCIDENT_DETAILS',
        incidentId: id,
      });
    }

    let assignedAmbulance: Ambulance | undefined = undefined;
    if (incident.assignedAmbulanceId) {
      const amb = await ambulanceRepository.findById(incident.assignedAmbulanceId);
      if (amb) assignedAmbulance = amb;
    }

    let destinationHospital: Hospital | undefined = undefined;
    if (incident.destinationHospitalId) {
      const hosp = await hospitalRepository.findById(incident.destinationHospitalId);
      if (hosp) destinationHospital = hosp;
    }

    return { incident, assignedAmbulance, destinationHospital };
  }

  public async listAvailableAmbulances(): Promise<Ambulance[]> {
    return await ambulanceRepository.findAvailable();
  }

  public async findNearestAmbulances(
    latitude: number,
    longitude: number,
    radiusMeters = 50000
  ): Promise<Array<{ ambulance: Ambulance; distanceMeters: number }>> {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new ValidationError('latitude and longitude must be numbers', {
        source: 'DISPATCH_CENTER',
        operation: 'FIND_NEAREST_AMBULANCES',
      });
    }

    const nearestResults = await incidentRepository.findNearestAmbulancesSpatial(
      latitude,
      longitude,
      radiusMeters
    );

    const detailedList: Array<{ ambulance: Ambulance; distanceMeters: number }> = [];
    for (const res of nearestResults) {
      const amb = await ambulanceRepository.findById(res.ambulanceId);
      if (amb && amb.status === 'AVAILABLE') {
        detailedList.push({ ambulance: amb, distanceMeters: Math.round(res.distanceMeters) });
      }
    }

    return detailedList;
  }

  public async assignAmbulance(request: DispatchAssignmentRequest): Promise<void> {
    if (!request.incidentId || !request.ambulanceId) {
      throw new ValidationError('incidentId and ambulanceId are required for dispatch assignment', {
        source: 'DISPATCH_CENTER',
        operation: 'ASSIGN_AMBULANCE',
        incidentId: request.incidentId,
        ambulanceId: request.ambulanceId,
      });
    }

    // Verify ambulance availability before transaction
    const ambulance = await ambulanceRepository.findById(request.ambulanceId);
    if (!ambulance) {
      throw new NotFoundError(`Ambulance '${request.ambulanceId}' not found`, {
        source: 'DISPATCH_CENTER',
        operation: 'ASSIGN_AMBULANCE',
        ambulanceId: request.ambulanceId,
      });
    }

    if (ambulance.status !== 'AVAILABLE') {
      throw new ValidationError(
        `Ambulance '${request.ambulanceId}' is currently in status '${ambulance.status}' and cannot be assigned`,
        {
          source: 'DISPATCH_CENTER',
          operation: 'ASSIGN_AMBULANCE',
          ambulanceId: request.ambulanceId,
        }
      );
    }

    // Execute atomic database transaction
    await transactionManager.executeAmbulanceAssignmentTransaction(
      request.incidentId,
      request.ambulanceId,
      request.hospitalId
    );

    await auditService.logEvent({
      who: '108_DISPATCH_OPERATOR',
      what: `Assigned ambulance ${request.ambulanceId} to incident ${request.incidentId}`,
      source: 'DISPATCH_CENTER',
      action: 'ASSIGN_AMBULANCE',
      result: 'SUCCESS',
      incidentId: request.incidentId,
      ambulanceId: request.ambulanceId,
      hospitalId: request.hospitalId,
    });

    webSocketManager.broadcastAmbulanceAssigned({
      incidentId: request.incidentId,
      ambulanceId: request.ambulanceId,
      hospitalId: request.hospitalId,
    });

    // Attempt ML ETA prediction in background
    const incident = await incidentRepository.findById(request.incidentId);
    if (incident && ambulance.currentLocation?.latitude && ambulance.currentLocation?.longitude) {
      // Very rough distance estimate for ML input (haversine)
      const R = 6371; // km
      const dLat = (incident.location.latitude - ambulance.currentLocation.latitude) * Math.PI / 180;
      const dLon = (incident.location.longitude - ambulance.currentLocation.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(ambulance.currentLocation.latitude * Math.PI / 180) * Math.cos(incident.location.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance_km = R * c;

      MLService.predictETA({
        distance_km: distance_km,
        route_distance_km: distance_km * 1.3,
        time_of_day: new Date().getHours() + new Date().getMinutes() / 60,
        day_of_week: new Date().getDay(),
        traffic_factor: 1.0, // Should be pulled from maps API, default 1.0
        average_speed_kmh: 40,
        road_complexity: 2,
        weather_factor: 1.0,
        ambulance_load_factor: 0.5,
        pickup_delay_minutes: 1.5,
      }).then(async (etaResult) => {
        if (etaResult) {
          try {
            await prisma.mLETAPrediction.create({
              data: {
                incidentId: request.incidentId,
                ambulanceId: request.ambulanceId,
                predictedEtaMinutes: etaResult.predicted_eta_minutes,
                lowerBound: etaResult.prediction_interval.lower,
                upperBound: etaResult.prediction_interval.upper,
                modelVersion: etaResult.model_version
              }
            });
          } catch (e) {
            // Ignore DB errors in background ML task
          }
        }
      }).catch(() => {});
    }
  }

  public async findCandidateHospitals(
    latitude: number,
    longitude: number,
    requiredBedType: 'EMERGENCY' | 'ICU' = 'EMERGENCY',
    radiusMeters = 50000
  ): Promise<Array<{ hospital: Hospital; distanceMeters: number }>> {
    const nearestResults = await hospitalRepository.findNearestAcceptingHospitalsSpatial(
      latitude,
      longitude,
      radiusMeters
    );

    const candidates: Array<{ hospital: Hospital; distanceMeters: number }> = [];

    for (const res of nearestResults) {
      const hosp = await hospitalRepository.findById(res.hospitalId);
      if (hosp && hosp.capacity.acceptingPatients) {
        const hasBed =
          requiredBedType === 'ICU'
            ? hosp.capacity.availableICUBeds > 0
            : hosp.capacity.availableEmergencyBeds > 0;

        if (hasBed) {
          candidates.push({ hospital: hosp, distanceMeters: Math.round(res.distanceMeters) });
        }
      }
    }

    return candidates;
  }

  public async createHospitalReservation(
    incidentId: string,
    hospitalId: string,
    bedType: 'EMERGENCY' | 'ICU' | 'GENERAL' = 'EMERGENCY'
  ): Promise<BedReservation> {
    const hospital = await hospitalRepository.findById(hospitalId);
    if (!hospital || !hospital.capacity.acceptingPatients) {
      throw new ValidationError(`Hospital '${hospitalId}' is not accepting patients`, {
        source: 'DISPATCH_CENTER',
        operation: 'CREATE_RESERVATION',
        hospitalId,
        incidentId,
      });
    }

    const reservation = await reservationRepository.create({
      incidentId,
      hospitalId,
      bedType,
      status: 'PENDING',
    });

    await auditService.logEvent({
      who: '108_DISPATCH_OPERATOR',
      what: `Requested bed reservation ${reservation.id} at hospital ${hospitalId} for incident ${incidentId}`,
      source: 'DISPATCH_CENTER',
      action: 'CREATE_RESERVATION',
      result: 'SUCCESS',
      incidentId,
      hospitalId,
    });

    webSocketManager.broadcastReservationRequested(reservation);

    return reservation;
  }

  public async getReservationState(reservationId: string): Promise<BedReservation> {
    const res = await reservationRepository.findById(reservationId);
    if (!res) {
      throw new NotFoundError(`Reservation '${reservationId}' not found`, {
        source: 'DISPATCH_CENTER',
        operation: 'GET_RESERVATION_STATE',
      });
    }
    return res;
  }

  public async executeReroute(request: DispatchRerouteRequest): Promise<void> {
    if (!request.incidentId || !request.ambulanceId || !request.newHospitalId || !request.reason) {
      throw new ValidationError(
        'incidentId, ambulanceId, newHospitalId, and mandatory reason are required for rerouting',
        {
          source: 'DISPATCH_CENTER',
          operation: 'EXECUTE_REROUTE',
          incidentId: request.incidentId,
          ambulanceId: request.ambulanceId,
          hospitalId: request.newHospitalId,
        }
      );
    }

    const newHospital = await hospitalRepository.findById(request.newHospitalId);
    if (!newHospital || !newHospital.capacity.acceptingPatients) {
      throw new ValidationError(
        `Reroute target hospital '${request.newHospitalId}' is unavailable or not accepting patients`,
        {
          source: 'DISPATCH_CENTER',
          operation: 'EXECUTE_REROUTE',
          hospitalId: request.newHospitalId,
        }
      );
    }

    await incidentRepository.update(request.incidentId, {
      destinationHospitalId: request.newHospitalId,
    });

    await ambulanceRepository.update(request.ambulanceId, {
      destinationHospitalId: request.newHospitalId,
    });

    await auditService.logEvent({
      who: '108_DISPATCH_OPERATOR',
      what: `Rerouted ambulance ${request.ambulanceId} to new hospital ${request.newHospitalId}. Mandatory Reason: ${request.reason}`,
      source: 'DISPATCH_CENTER',
      action: 'EXECUTE_REROUTE',
      result: 'SUCCESS',
      incidentId: request.incidentId,
      ambulanceId: request.ambulanceId,
      hospitalId: request.newHospitalId,
      metadata: { rerouteReason: request.reason },
    });

    webSocketManager.broadcastReroute({
      incidentId: request.incidentId,
      ambulanceId: request.ambulanceId,
      newHospitalId: request.newHospitalId,
      reason: request.reason,
    });
  }

  public async getIncidentTimeline(incidentId: string): Promise<AuditLogEntry[]> {
    return await auditService.getAuditLogs({ incidentId });
  }
}

export const dispatchService = new DispatchService();
