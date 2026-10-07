import request from 'supertest';
import { app } from '../src/server/app';
import { prisma, dbService } from '../src/config/database';

describe('Public SOS API Idempotency and Concurrency', () => {
  beforeAll(async () => {
    // Ensure DB is connected for real tests
    if (!dbService.isDbConnected()) {
      await dbService.checkDatabaseHealth();
    }
    // Clean incidents for isolated tests
    await prisma.emergencyIncident.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.emergencyIncident.deleteMany({});
  });

  const validPayload = {
    emergencyType: 'ACCIDENT',
    location: {
      latitude: 12.9716,
      longitude: 77.5946,
      address: 'Test Address'
    },
    description: 'Test accident'
  };

  it('valid SOS creates one Incident', async () => {
    const res = await request(app)
      .post('/api/public/sos')
      .send({ ...validPayload, idempotencyKey: 'key1' });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incident).toBeDefined();

    const count = await prisma.emergencyIncident.count({ where: { idempotencyKey: 'key1' } });
    expect(count).toBe(1);
  });

  it('same idempotencyKey repeated returns same Incident and no duplicates', async () => {
    const res1 = await request(app)
      .post('/api/public/sos')
      .send({ ...validPayload, idempotencyKey: 'key2' });
    
    expect(res1.status).toBe(201);
    const incidentId = res1.body.data.incident.id;

    const res2 = await request(app)
      .post('/api/public/sos')
      .send({ ...validPayload, idempotencyKey: 'key2' });

    expect(res2.status).toBe(201);
    expect(res2.body.data.incident.id).toBe(incidentId);

    const count = await prisma.emergencyIncident.count({ where: { idempotencyKey: 'key2' } });
    expect(count).toBe(1);
  });

  it('same idempotencyKey with materially different payload returns 409 Conflict', async () => {
    const res1 = await request(app)
      .post('/api/public/sos')
      .send({ ...validPayload, idempotencyKey: 'key3' });
    
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/public/sos')
      .send({ ...validPayload, emergencyType: 'FIRE', idempotencyKey: 'key3' });

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);

    const count = await prisma.emergencyIncident.count({ where: { idempotencyKey: 'key3' } });
    expect(count).toBe(1);
  });

  it('malformed request returns 400', async () => {
    const res = await request(app)
      .post('/api/public/sos')
      .send({ emergencyType: 'ACCIDENT' }); // missing location and description
    
    expect(res.status).toBe(400);
  });

  it('concurrent identical requests create exactly one Incident', async () => {
    const promises = [];
    const idempotencyKey = 'concurrent_key_1';

    for (let i = 0; i < 5; i++) {
      promises.push(
        request(app)
          .post('/api/public/sos')
          .send({ ...validPayload, idempotencyKey })
      );
    }

    const responses = await Promise.all(promises);
    
    let createdCount = 0;
    let conflictCount = 0;

    const incidentIds = new Set();
    responses.forEach(res => {
      if (res.status === 201) {
        createdCount++;
        incidentIds.add(res.body.data.incident.id);
      } else {
        conflictCount++;
      }
    });

    // All should be 201s because they all return the identical existing (or new) incident
    expect(createdCount).toBe(5);
    expect(incidentIds.size).toBe(1); // All requests returned the EXACT SAME incident ID

    const count = await prisma.emergencyIncident.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });
});
