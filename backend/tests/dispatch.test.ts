import request from 'supertest';
import { app } from '../src/server/app';
import { incidentRepository } from '../src/repositories/IncidentRepository';
import { ambulanceRepository } from '../src/repositories/AmbulanceRepository';
import { hospitalRepository } from '../src/repositories/HospitalRepository';

describe('5. 108 Dispatch Center APIs (/api/dispatch)', () => {
  let testIncidentId: string;
  let availableAmbulanceId: string;
  let assignedAmbulanceId: string;
  let targetHospitalId: string;
  let rerouteHospitalId: string;
  const { generateToken } = require('../src/middleware/authHandler');
  let dispatchToken: string;

  beforeAll(async () => {
    const inc = await incidentRepository.create({
      emergencyType: 'ACCIDENT',
      location: { latitude: 12.9716, longitude: 77.5946 },
      description: 'Highway multi-vehicle accident',
      status: 'REPORTED',
    });
    testIncidentId = inc.id;

    const amb1 = await ambulanceRepository.create({
      vehicleNumber: `AMB-DISP-1-${Date.now()}`,
      driverName: 'Driver Alpha',
      driverPhone: '+919111111111',
      status: 'AVAILABLE',
      currentLocation: { latitude: 12.972, longitude: 77.595 },
    });
    availableAmbulanceId = amb1.id;

    const amb2 = await ambulanceRepository.create({
      vehicleNumber: `AMB-DISP-2-${Date.now()}`,
      driverName: 'Driver Beta',
      driverPhone: '+919222222222',
      status: 'ASSIGNED',
      currentLocation: { latitude: 12.98, longitude: 77.6 },
    });
    assignedAmbulanceId = amb2.id;

    const hosp1 = await hospitalRepository.create({
      name: 'General Dispatch Hospital',
      location: { latitude: 12.975, longitude: 77.598 },
      contactNumber: '+918099999999',
      capacity: {
        totalBeds: 40,
        availableICUBeds: 4,
        availableEmergencyBeds: 10,
        availableVentilators: 2,
        traumaCenterLevel: 1,
        acceptingPatients: true,
      },
      specialties: ['TRAUMA'],
    });
    targetHospitalId = hosp1.id;

    const hosp2 = await hospitalRepository.create({
      name: 'Reroute Emergency Care Center',
      location: { latitude: 12.985, longitude: 77.61 },
      contactNumber: '+918077777777',
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
    rerouteHospitalId = hosp2.id;
    dispatchToken = generateToken({ id: 'DISPATCH-1', role: 'DISPATCHER' });
  });

  it('GET /api/dispatch/incidents - should list active emergency incidents', async () => {
    const res = await request(app).get('/api/dispatch/incidents').set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/dispatch/ambulances/available - should list available ambulances', async () => {
    const res = await request(app).get('/api/dispatch/ambulances/available').set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((a: any) => a.id === availableAmbulanceId)).toBe(true);
  });

  it('GET /api/dispatch/ambulances/nearest - should find nearest available ambulances via spatial search', async () => {
    const res = await request(app).get(
      '/api/dispatch/ambulances/nearest?latitude=12.9716&longitude=77.5946&radiusMeters=50000'
    ).set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/dispatch/assign - should reject duplicate assignment of unavailable ambulance', async () => {
    const res = await request(app).post('/api/dispatch/assign').send({
      incidentId: testIncidentId,
      ambulanceId: assignedAmbulanceId, // already ASSIGNED
      hospitalId: targetHospitalId,
    }).set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('cannot be assigned');
  });

  it('POST /api/dispatch/assign - should atomically assign available ambulance to incident', async () => {
    const res = await request(app).post('/api/dispatch/assign').send({
      incidentId: testIncidentId,
      ambulanceId: availableAmbulanceId,
      hospitalId: targetHospitalId,
    }).set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/dispatch/reroute - should reject reroute without mandatory reason', async () => {
    const res = await request(app).post('/api/dispatch/reroute').send({
      incidentId: testIncidentId,
      ambulanceId: availableAmbulanceId,
      newHospitalId: rerouteHospitalId,
      // missing reason
    }).set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details[0].message).toContain('Required');
  });

  it('POST /api/dispatch/reroute - should execute reroute with mandatory reason', async () => {
    const res = await request(app).post('/api/dispatch/reroute').send({
      incidentId: testIncidentId,
      ambulanceId: availableAmbulanceId,
      newHospitalId: rerouteHospitalId,
      reason: 'Original hospital trauma ward overload',
    }).set('Authorization', `Bearer ${dispatchToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
