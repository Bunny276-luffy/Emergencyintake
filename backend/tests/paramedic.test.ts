import request from 'supertest';
import { app } from '../src/server/app';
import { incidentRepository } from '../src/repositories/IncidentRepository';

describe('3. Paramedic Team APIs (/api/paramedic)', () => {
  let testIncidentId: string;
  const { generateToken } = require('../src/middleware/authHandler');
  let paramedicToken: string;

  beforeAll(async () => {
    const inc = await incidentRepository.create({
      emergencyType: 'STROKE',
      location: { latitude: 12.93, longitude: 77.62 },
      description: 'Acute facial droop and speech difficulty',
      status: 'REPORTED',
    });
    testIncidentId = inc.id;
    paramedicToken = generateToken({ id: 'PARAMEDIC-1', role: 'ADMIN' });
  });

  it('GET /api/paramedic/incident/:incidentId - should retrieve assigned incident details', async () => {
    const res = await request(app).get(`/api/paramedic/incident/${testIncidentId}`).set('Authorization', `Bearer ${paramedicToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incident.id).toBe(testIncidentId);
  });

  it('POST /api/paramedic/report - should validate required clinical fields (400)', async () => {
    const res = await request(app).post('/api/paramedic/report').set('Authorization', `Bearer ${paramedicToken}`).send({
      incidentId: testIncidentId,
      // missing patientConditionSummary and triageLevel
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/paramedic/report - should submit patient clinical assessment and vitals', async () => {
    const res = await request(app).post('/api/paramedic/report').set('Authorization', `Bearer ${paramedicToken}`).send({
      incidentId: testIncidentId,
      patientConditionSummary: 'Left-sided weakness, slurred speech',
      triageLevel: 'IMMEDIATE_RED',
      vitals: {
        heartRate: 98,
        bloodPressureSystolic: 160,
        bloodPressureDiastolic: 100,
        oxygenSaturation: 95,
        recordedAt: new Date().toISOString(),
      },
      voiceReportAudioUrl: 'https://storage.emergency.ai/audio/rep-test.wav',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.triageLevel).toBe('IMMEDIATE_RED');
    expect(res.body.data.vitals.heartRate).toBe(98);
  });

  it('GET /api/paramedic/report/:incidentId - should retrieve clinical report for incident', async () => {
    const res = await request(app).get(`/api/paramedic/report/${testIncidentId}`).set('Authorization', `Bearer ${paramedicToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incidentId).toBe(testIncidentId);
    expect(res.body.data.triageLevel).toBe('IMMEDIATE_RED');
  });
});
