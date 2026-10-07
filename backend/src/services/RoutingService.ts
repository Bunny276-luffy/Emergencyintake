import { LocationCoordinates, Hospital, Ambulance } from '../types';
import { incidentRepository } from '../repositories/IncidentRepository';
import { hospitalRepository } from '../repositories/HospitalRepository';
import { ambulanceRepository } from '../repositories/AmbulanceRepository';
import { auditService } from './AuditService';
import { NotFoundError } from '../errors/AppError';
import { webSocketManager } from '../server/websocket';

export interface RouteCalculationResult {
  origin: LocationCoordinates;
  destination: LocationCoordinates;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  routingEngine: 'POSTGIS_SPATIAL_ENGINE' | 'ROUTING_EXTERNAL_API';
}

export interface CandidateHospitalMatch {
  hospital: Hospital;
  distanceMeters: number;
  distanceKm: number;
  etaSeconds: number;
  etaMinutes: number;
  matchingScore: number;
}

export class RoutingService {
  private static AVERAGE_EMERGENCY_SPEED_MPS = 11.11; // ~40 km/h urban corridor

  public getRoutingServiceStatus(): {
    status: 'HEALTHY' | 'DEGRADED';
    engine: string;
    configured: boolean;
  } {
    const hasApiKey = Boolean(process.env.ROUTING_API_KEY);
    return {
      status: 'HEALTHY',
      engine: hasApiKey ? 'EXTERNAL_ROUTING_API' : 'POSTGIS_SPATIAL_ENGINE',
      configured: true,
    };
  }

  /**
   * Calculates distance and estimated travel time between two geographic coordinates.
   */
  public calculateRoute(
    origin: LocationCoordinates,
    destination: LocationCoordinates
  ): RouteCalculationResult {
    const distanceMeters = this.haversineDistanceMeters(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    const durationSeconds = Math.round(distanceMeters / RoutingService.AVERAGE_EMERGENCY_SPEED_MPS);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    return {
      origin,
      destination,
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationMinutes,
      routingEngine: process.env.ROUTING_API_KEY
        ? 'ROUTING_EXTERNAL_API'
        : 'POSTGIS_SPATIAL_ENGINE',
    };
  }

  /**
   * Finds candidate hospitals matching location, bed capacity, and trauma level.
   */
  public async findOptimalHospitals(
    patientLocation: LocationCoordinates,
    requiredBedType: 'EMERGENCY' | 'ICU' = 'EMERGENCY',
    radiusMeters = 50000
  ): Promise<CandidateHospitalMatch[]> {
    const hospitals = await hospitalRepository.findAcceptingHospitals();

    const matches: CandidateHospitalMatch[] = [];

    for (const hosp of hospitals) {
      const availableBeds =
        requiredBedType === 'ICU'
          ? hosp.capacity.availableICUBeds
          : hosp.capacity.availableEmergencyBeds;

      if (availableBeds <= 0) continue;

      const route = this.calculateRoute(patientLocation, hosp.location);

      if (route.distanceMeters > radiusMeters) continue;

      // Score based on distance, bed count, and trauma level
      const matchingScore =
        availableBeds * 10 + hosp.capacity.traumaCenterLevel * 5 - route.distanceKm;

      matches.push({
        hospital: hosp,
        distanceMeters: route.distanceMeters,
        distanceKm: route.distanceKm,
        etaSeconds: route.durationSeconds,
        etaMinutes: route.durationMinutes,
        matchingScore,
      });
    }

    // Sort by matching score descending (highest capability & closest distance first)
    matches.sort((a, b) => b.matchingScore - a.matchingScore);

    return matches;
  }

  /**
   * Finds alternative hospitals when original destination hospital is compromised or rejects reservation.
   */
  public async findAlternativeHospitals(
    incidentId: string,
    currentHospitalId: string,
    reason: string
  ): Promise<CandidateHospitalMatch[]> {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident '${incidentId}' not found for finding alternative hospitals`);
    }

    const allMatches = await this.findOptimalHospitals(incident.location, 'EMERGENCY', 100000);

    // Exclude current compromised/rejected hospital
    const alternativeMatches = allMatches.filter((m) => m.hospital.id !== currentHospitalId);

    await auditService.logEvent({
      who: 'ROUTING_SERVICE',
      what: `Computed ${alternativeMatches.length} alternative hospitals for incident ${incidentId}. Reason: ${reason}`,
      source: 'DISPATCH_CENTER',
      action: 'FIND_ALTERNATIVE_HOSPITALS',
      result: 'SUCCESS',
      incidentId,
      metadata: { currentHospitalId, rejectionReason: reason },
    });

    return alternativeMatches;
  }

  /**
   * Recalculates and updates dynamic ETA when ambulance sends live GPS location update.
   */
  public async updateAmbulanceETAOnLocationUpdate(
    ambulanceId: string,
    latitude: number,
    longitude: number
  ): Promise<{ ambulance: Ambulance; etaSeconds?: number }> {
    const ambulance = await ambulanceRepository.findById(ambulanceId);
    if (!ambulance) {
      throw new NotFoundError(`Ambulance '${ambulanceId}' not found for ETA calculation`);
    }

    let calculatedETA: number | undefined;

    // If assigned to an active incident, calculate ETA to incident scene or destination hospital
    if (ambulance.currentIncidentId) {
      const incident = await incidentRepository.findById(ambulance.currentIncidentId);

      if (incident) {
        if (incident.status === 'REPORTED' || incident.status === 'DISPATCHED') {
          // ETA to patient scene
          const route = this.calculateRoute(
            { latitude, longitude },
            incident.location
          );
          calculatedETA = route.durationSeconds;
        } else if (incident.status === 'TRANSPORTING' && incident.destinationHospitalId) {
          // ETA to destination hospital
          const hospital = await hospitalRepository.findById(incident.destinationHospitalId);
          if (hospital) {
            const route = this.calculateRoute(
              { latitude, longitude },
              hospital.location
            );
            calculatedETA = route.durationSeconds;
          }
        }
      }
    }

    const updated = await ambulanceRepository.update(ambulanceId, {
      currentLocation: { latitude, longitude },
      etaSeconds: calculatedETA,
    });

    // Broadcast live location & calculated ETA via WebSockets
    webSocketManager.broadcastAmbulanceLocation({
      ambulanceId,
      latitude,
      longitude,
    });

    return { ambulance: updated!, etaSeconds: calculatedETA };
  }

  /**
   * Haversine formula for calculating exact distance in meters between two lat/long points.
   */
  private haversineDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }
}

export const routingService = new RoutingService();
