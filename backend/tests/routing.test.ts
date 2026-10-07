import { routingService } from '../src/services/RoutingService';
import { hospitalRepository } from '../src/repositories/HospitalRepository';
import { incidentRepository } from '../src/repositories/IncidentRepository';
import { ambulanceRepository } from '../src/repositories/AmbulanceRepository';

describe('Phase 5: Routing & Location Intelligence', () => {
  let hosp1Id: string;
  let hosp2Id: string;
  let incidentId: string;
  let ambulanceId: string;

  beforeAll(async () => {
    const hosp1 = await hospitalRepository.create({
      name: 'Central Trauma Hospital',
      location: { latitude: 12.97, longitude: 77.59 },
      contactNumber: '+918011111111',
      capacity: {
        totalBeds: 50,
        availableICUBeds: 5,
        availableEmergencyBeds: 15,
        availableVentilators: 3,
        traumaCenterLevel: 1,
        acceptingPatients: true,
      },
      specialties: ['TRAUMA', 'CARDIOLOGY'],
    });
    hosp1Id = hosp1.id;

    const hosp2 = await hospitalRepository.create({
      name: 'East Suburb Hospital',
      location: { latitude: 13.0, longitude: 77.65 },
      contactNumber: '+918022222222',
      capacity: {
        totalBeds: 30,
        availableICUBeds: 2,
        availableEmergencyBeds: 8,
        availableVentilators: 1,
        traumaCenterLevel: 2,
        acceptingPatients: true,
      },
      specialties: ['TRAUMA'],
    });
    hosp2Id = hosp2.id;

    const inc = await incidentRepository.create({
      emergencyType: 'ACCIDENT',
      location: { latitude: 12.95, longitude: 77.58 },
      description: 'Severe multi-vehicle accident',
      status: 'REPORTED',
    });
    incidentId = inc.id;

    const amb = await ambulanceRepository.create({
      vehicleNumber: `AMB-ROUTE-${Date.now()}`,
      driverName: 'Driver Carl',
      driverPhone: '+919888877777',
      status: 'ASSIGNED',
      currentLocation: { latitude: 12.93, longitude: 77.56 },
      currentIncidentId: incidentId,
    });
    ambulanceId = amb.id;
  });

  it('calculateRoute - should calculate distance in meters/km and duration in seconds/minutes', () => {
    const origin = { latitude: 12.9716, longitude: 77.5946 };
    const destination = { latitude: 12.98, longitude: 77.6 };

    const route = routingService.calculateRoute(origin, destination);

    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.distanceKm).toBeGreaterThan(0);
    expect(route.durationSeconds).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(route.routingEngine).toBeDefined();
  });

  it('findOptimalHospitals - should rank candidate hospitals by capacity and distance', async () => {
    const matches = await routingService.findOptimalHospitals(
      { latitude: 12.95, longitude: 77.58 },
      'EMERGENCY',
      50000
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].hospital.id).toBeDefined();
    expect(matches[0].etaSeconds).toBeGreaterThan(0);
  });

  it('findAlternativeHospitals - should exclude compromised hospital and return alternative candidates', async () => {
    const alternatives = await routingService.findAlternativeHospitals(
      incidentId,
      hosp1Id, // compromised hospital
      'Trauma ward at capacity'
    );

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.some((a) => a.hospital.id === hosp1Id)).toBe(false);
  });

  it('updateAmbulanceETAOnLocationUpdate - should calculate dynamic ETA upon location update', async () => {
    const result = await routingService.updateAmbulanceETAOnLocationUpdate(
      ambulanceId,
      12.94,
      77.57
    );

    expect(result.ambulance.currentLocation?.latitude).toBe(12.94);
    expect(result.etaSeconds).toBeGreaterThan(0);
  });

  it('getRoutingServiceStatus - should report routing engine status', () => {
    const status = routingService.getRoutingServiceStatus();
    expect(status.status).toBe('HEALTHY');
    expect(status.engine).toBeDefined();
  });
});
