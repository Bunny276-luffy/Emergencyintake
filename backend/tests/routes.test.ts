import request from 'supertest';
import { app } from '../src/server/app';

describe('API Route Architecture & Unknown Route Handling', () => {
  it('GET /api/nonexistent-route should return 404 with standardized error response', async () => {
    const res = await request(app).get('/api/nonexistent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain('Cannot GET /api/nonexistent-route');
    expect(res.body.error.source).toBe('API_GATEWAY');
  });

  it('POST /api/public/sos without body should return 400 validation error', async () => {
    const res = await request(app).post('/api/public/sos').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details[0].message).toContain('Required');
  });

  it('GET /api/admin/errors should return system errors registered during requests', async () => {
    const { generateToken } = require('../src/middleware/authHandler');
    const adminToken = generateToken({ id: 'ADMIN-SYS', role: 'ADMIN' });
    const res = await request(app)
      .get('/api/admin/errors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
