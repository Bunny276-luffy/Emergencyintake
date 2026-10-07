import request from 'supertest';
import { app } from '../src/server/app';

describe('6. Admin Command Center APIs (/api/admin)', () => {
  const { generateToken } = require('../src/middleware/authHandler');
  const adminToken = generateToken({ id: 'ADMIN-1', role: 'ADMIN' });

  it('GET /api/admin/health - should return global component health status', async () => {
    const res = await request(app).get('/api/admin/health').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.components.backend.status).toBe('HEALTHY');
  });

  it('GET /api/admin/errors - should return system errors across applications', async () => {
    const res = await request(app).get('/api/admin/errors').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/audit - should return system audit log trail', async () => {
    const res = await request(app).get('/api/admin/audit').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/stats - should return real operational statistics summary', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalIncidents).toBeDefined();
    expect(res.body.data.totalAmbulances).toBeDefined();
    expect(res.body.data.totalHospitals).toBeDefined();
  });

  it('GET /api/admin/ambulances - should return fleet overview', async () => {
    const res = await request(app).get('/api/admin/ambulances').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/admin/hospitals - should return hospitals overview', async () => {
    const res = await request(app).get('/api/admin/hospitals').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
