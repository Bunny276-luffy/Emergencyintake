import request from 'supertest';
import { app } from '../src/server/app';

describe('1. Public SOS APIs (/api/public)', () => {
  let createdIncidentId: string;

  it('POST /api/public/sos - should reject requests missing required fields (400)', async () => {
    const res = await request(app).post('/api/public/sos').send({
      emergencyType: 'ACCIDENT',
      // missing location and description
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details[0].message).toContain('Required');
  });

  it('POST /api/public/sos - should create emergency incident and patient record', async () => {
    const res = await request(app).post('/api/public/sos').send({
      emergencyType: 'STEMI',
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'MG Road, Bengaluru',
      },
      description: 'Patient experiencing acute chest pain',
      reporterContact: '+919876543210',
      patientInfo: {
        name: 'Jane Doe',
        age: 52,
        gender: 'FEMALE',
        knownMedicalConditions: ['Hypertension'],
        allergies: ['Aspirin'],
        bloodType: 'A+',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incident).toBeDefined();
    expect(res.body.data.incident.id).toBeDefined();
    expect(res.body.data.incident.status).toBe('REPORTED');
    expect(res.body.data.patient).toBeDefined();
    expect(res.body.data.patient.name).toBe('Jane Doe');

    createdIncidentId = res.body.data.incident.id;
  });

  it('GET /api/public/incident/:id - should retrieve created incident by ID', async () => {
    const res = await request(app).get(`/api/public/incident/${createdIncidentId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdIncidentId);
    expect(res.body.data.emergencyType).toBe('STEMI');
  });

  it('GET /api/public/incident/non-existent-id - should return 404', async () => {
    const res = await request(app).get('/api/public/incident/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
