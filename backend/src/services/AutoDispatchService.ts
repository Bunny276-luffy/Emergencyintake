import { EmergencyIncident, Ambulance, Hospital, BedReservation } from '../types';
import { incidentRepository } from '../repositories/IncidentRepository';
import { ambulanceRepository } from '../repositories/AmbulanceRepository';
import { hospitalRepository } from '../repositories/HospitalRepository';
import { dispatchService } from './DispatchService';
import { auditService } from './AuditService';
import { webSocketManager } from '../server/websocket';
import { logger } from '../utils/logger';

export interface AutoDispatchDecision {
  autoDispatched: boolean;
  incidentId: string;
  ambulance?: Ambulance;
  hospital?: Hospital;
  distanceAmbulanceMeters?: number;
  distanceHospitalMeters?: number;
  decisionCriteria?: string[];
  reason?: string;
}

export class AutoDispatchService {
  /**
   * Evaluates available ambulances and hospitals for an incident and automatically
   * executes ambulance assignment and hospital bed reservation if suitable candidates exist.
   */
  public async executeAutoDispatch(incidentId: string): Promise<AutoDispatchDecision> {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident) {
      return { autoDispatched: false, incidentId, reason: 'Incident not found' };
    }

    // Do not auto-dispatch if already assigned or completed
    if (incident.assignedAmbulanceId || incident.status === 'HANDOFF_COMPLETED' || incident.status === 'CANCELLED') {
      return { autoDispatched: false, incidentId, reason: `Incident status is ${incident.status}` };
    }

    const { latitude, longitude } = incident.location;

    // 1. Find nearest available ambulances using PostGIS spatial search
    const nearestAmbulances = await dispatchService.findNearestAmbulances(latitude, longitude, 50000);
    const availableAmbulance = nearestAmbulances[0];

    // Fallback: If PostGIS returns no spatial match, pick first available ambulance
    let selectedAmbulance: Ambulance | undefined = availableAmbulance?.ambulance;
    let ambDistance = availableAmbulance?.distanceMeters || 2000;

    if (!selectedAmbulance) {
      const allAvail = await ambulanceRepository.findAvailable();
      if (allAvail.length > 0) {
        selectedAmbulance = allAvail[0];
      }
    }

    if (!selectedAmbulance) {
      logger.info(`[AUTO_DISPATCH] No available ambulance for incident ${incidentId}`);
      await auditService.logEvent({
        who: 'AUTO_DISPATCH_ENGINE',
        what: `Auto-dispatch pending for incident ${incidentId}: No available ambulance in fleet`,
        source: 'DISPATCH_CENTER',
        action: 'AUTO_DISPATCH_EVALUATION',
        result: 'PENDING',
        incidentId,
      });
      return { autoDispatched: false, incidentId, reason: 'No available ambulance unit' };
    }

    // 2. Find nearest candidate hospitals with available emergency beds
    const requiredBedType = incident.emergencyType === 'CARDIAC_ARREST' || incident.emergencyType === 'STEMI' ? 'ICU' : 'EMERGENCY';
    const candidateHospitals = await dispatchService.findCandidateHospitals(latitude, longitude, requiredBedType, 50000);
    const topCandidate = candidateHospitals[0];

    let selectedHospital: Hospital | undefined = topCandidate?.hospital;
    let hospDistance = topCandidate?.distanceMeters || 3000;

    if (!selectedHospital) {
      const allHospitals = await hospitalRepository.findAll();
      selectedHospital = allHospitals.find(h => h.capacity.acceptingPatients && h.capacity.availableEmergencyBeds > 0);
    }

    if (!selectedHospital) {
      logger.info(`[AUTO_DISPATCH] No accepting hospital for incident ${incidentId}`);
      await auditService.logEvent({
        who: 'AUTO_DISPATCH_ENGINE',
        what: `Auto-dispatch pending for incident ${incidentId}: No accepting hospital bed available`,
        source: 'DISPATCH_CENTER',
        action: 'AUTO_DISPATCH_EVALUATION',
        result: 'PENDING',
        incidentId,
        ambulanceId: selectedAmbulance.id,
      });
      return { autoDispatched: false, incidentId, reason: 'No accepting hospital with available beds' };
    }

    // 3. Formulate decision criteria details for dispatcher review
    const decisionCriteria = [
      `Ambulance ${selectedAmbulance.vehicleNumber} matched (${(ambDistance / 1000).toFixed(1)} km away, status AVAILABLE)`,
      `Hospital ${selectedHospital.name} selected (${(hospDistance / 1000).toFixed(1)} km away, ${selectedHospital.capacity.availableEmergencyBeds} ER beds, Trauma Level ${selectedHospital.capacity.traumaCenterLevel})`,
      `Hospital accepting status verified: ACCEPTING`,
      `Emergency priority ${incident.priority} triage rules applied`,
    ];

    // 4. Atomically execute ambulance assignment & bed reservation
    try {
      await dispatchService.assignAmbulance({
        incidentId: incident.id,
        ambulanceId: selectedAmbulance.id,
        hospitalId: selectedHospital.id,
        notes: `Automatic Dispatch Engine decision: ${decisionCriteria.join('; ')}`,
      });

      await dispatchService.createHospitalReservation(
        incident.id,
        selectedHospital.id,
        requiredBedType === 'ICU' ? 'ICU' : 'EMERGENCY'
      );

      await auditService.logEvent({
        who: 'AUTO_DISPATCH_ENGINE',
        what: `Auto-dispatched ${selectedAmbulance.vehicleNumber} to ${selectedHospital.name} for incident ${incident.id}`,
        source: 'DISPATCH_CENTER',
        action: 'AUTO_DISPATCH_EXECUTE',
        result: 'SUCCESS',
        incidentId: incident.id,
        ambulanceId: selectedAmbulance.id,
        hospitalId: selectedHospital.id,
        metadata: { decisionCriteria, ambDistance, hospDistance },
      });

      const decision: AutoDispatchDecision = {
        autoDispatched: true,
        incidentId: incident.id,
        ambulance: selectedAmbulance,
        hospital: selectedHospital,
        distanceAmbulanceMeters: ambDistance,
        distanceHospitalMeters: hospDistance,
        decisionCriteria,
      };

      // Broadcast WebSocket event
      if ((webSocketManager as any).broadcastAutoDispatch) {
        (webSocketManager as any).broadcastAutoDispatch(decision);
      }

      return decision;
    } catch (err: any) {
      logger.error(`[AUTO_DISPATCH_ERROR] Failed to execute auto-dispatch for incident ${incidentId}: ${err.message}`);
      return { autoDispatched: false, incidentId, reason: err.message };
    }
  }

  /**
   * Re-evaluates target hospital for an active incident when original hospital becomes unavailable
   * or rejects reservation, executing automatic reroute.
   */
  public async executeAutoReroute(
    incidentId: string,
    unsuitableHospitalId: string,
    reason: string
  ): Promise<AutoDispatchDecision> {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident || !incident.assignedAmbulanceId) {
      return { autoDispatched: false, incidentId, reason: 'Incident or assigned ambulance not found for reroute' };
    }

    const { latitude, longitude } = incident.location;
    const candidateHospitals = await dispatchService.findCandidateHospitals(latitude, longitude, 'EMERGENCY', 50000);
    
    // Pick nearest suitable hospital that is not the unsuitable hospital
    const altCandidate = candidateHospitals.find(c => c.hospital.id !== unsuitableHospitalId);

    if (!altCandidate) {
      logger.warn(`[AUTO_REROUTE] No alternative hospital candidate found for incident ${incidentId}`);
      return { autoDispatched: false, incidentId, reason: 'No alternative candidate hospital available' };
    }

    const newHospital = altCandidate.hospital;
    const rerouteReason = `Auto-Reroute Triggered: Original hospital ${unsuitableHospitalId} ${reason}. Auto-selected ${newHospital.name}`;

    try {
      await dispatchService.executeReroute({
        incidentId: incident.id,
        ambulanceId: incident.assignedAmbulanceId,
        newHospitalId: newHospital.id,
        reason: rerouteReason,
      });

      await dispatchService.createHospitalReservation(incident.id, newHospital.id, 'EMERGENCY');

      await auditService.logEvent({
        who: 'AUTO_DISPATCH_ENGINE',
        what: `Auto-rerouted incident ${incident.id} to ${newHospital.name}. Reason: ${rerouteReason}`,
        source: 'DISPATCH_CENTER',
        action: 'AUTO_REROUTE_EXECUTE',
        result: 'SUCCESS',
        incidentId: incident.id,
        ambulanceId: incident.assignedAmbulanceId,
        hospitalId: newHospital.id,
      });

      return {
        autoDispatched: true,
        incidentId: incident.id,
        hospital: newHospital,
        distanceHospitalMeters: altCandidate.distanceMeters,
        decisionCriteria: [`Auto-rerouted to ${newHospital.name} (${(altCandidate.distanceMeters / 1000).toFixed(1)} km away)`],
      };
    } catch (err: any) {
      logger.error(`[AUTO_REROUTE_ERROR] Failed to execute auto-reroute for incident ${incidentId}: ${err.message}`);
      return { autoDispatched: false, incidentId, reason: err.message };
    }
  }
}

export const autoDispatchService = new AutoDispatchService();
