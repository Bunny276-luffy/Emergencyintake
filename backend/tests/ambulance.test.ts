import request from 'supertest';
import { app } from '../src/server/app';
import { ambulanceRepository } from '../src/repositories/AmbulanceRepository';
import { incidentRepository } from '../src/repositories/IncidentRepository';
import { hospitalRepository } from '../src/repositories/HospitalRepository';

describe('2. Ambulance Driver APIs (/api/ambulance)', () => {
  let testAmbulanceId: string;
  let testIncidentId: string;
  let testHospitalId: string;
  const { generateToken } = require('../src/middleware/authHandler');
  let driverToken: string;

  beforeAll(async () => {
    // Create actual test resources in database
    const amb = await ambulanceRepository.create({
      vehicleNumber: `AMB-TEST-${Date.now()}`,
      driverName: 'Driver Sam',
      driverPhone: '+919999900000',
      status: 'AVAILABLE',
      currentLocation: { latitude: 12.97, longitude: 77.59 },
    });
    testAmbulanceId = amb.id;
    driverToken = generateToken({ id: amb.id, role: 'ADMIN' });

    const hosp = await hospitalRepository.create({
      name: 'City Care Hospital',
      location: { latitude: 12.98, longitude: 77.60 },
      contactNumber: '+918888800000',
      capacity: {
        totalBeds: 50,
        availableICUBeds: 5,
        availableEmergencyBeds: 10,
        availableVentilators: 2,
        traumaCenterLevel: 1,
        acceptingPatients: true,
      },
      specialties: ['TRAUMA', 'CARDIOLOGY'],
    });
    testHospitalId = hosp.id;

    const inc = await incidentRepository.create({
      emergencyType: 'ACCIDENT',
      location: { latitude: 12.97, longitude: 77.59 },
      description: 'Vehicle accident',
      status: 'REPORTED',
    });
    testIncidentId = inc.id;
  });

  it('GET /api/ambulance/:ambulanceId/status - should retrieve ambulance status', async () => {
    const res = await request(app).get(`/api/ambulance/${testAmbulanceId}/status`).set('Authorization', `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testAmbulanceId);
    expect(res.body.data.status).toBe('AVAILABLE');
  });

  it('PATCH /api/ambulance/:ambulanceId/location - should update GPS coordinates', async () => {
    const res = await request(app)
      .patch(`/api/ambulance/${testAmbulanceId}/location`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ latitude: 12.975, longitude: 77.595 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentLocation.latitude).toBe(12.975);
    expect(res.body.data.currentLocation.longitude).toBe(77.595);
  });

  it('PATCH /api/ambulance/:ambulanceId/status - should validate status transition', async () => {
    // Valid: AVAILABLE -> ASSIGNED
    const resValid = await request(app)
      .patch(`/api/ambulance/${testAmbulanceId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'ASSIGNED' });

    expect(resValid.status).toBe(200);
    expect(resValid.body.data.status).toBe('ASSIGNED');

    // Invalid: ASSIGNED -> MAINTENANCE (invalid direct transition)
    const resInvalid = await request(app)
      .patch(`/api/ambulance/${testAmbulanceId}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'MAINTENANCE' });

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.success).toBe(false);
  });
});
