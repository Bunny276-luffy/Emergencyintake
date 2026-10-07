import request from 'supertest';
import express from 'express';
import dispatchRoutes from '../src/routes/dispatchRoutes';
import publicRoutes from '../src/routes/publicRoutes';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/public', publicRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Dispatch and SOS Security Tests', () => {
  it('should reject anonymous dispatch requests with 401', async () => {
    const res = await request(app).get('/api/dispatch/incidents');
    expect(res.status).toBe(401);
  });

  it('should reject invalid JWT with 403 or 401', async () => {
    const res = await request(app)
      .get('/api/dispatch/incidents')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401);
  });

  it('should reject non-dispatcher roles', async () => {
    const token = generateToken({ id: 'para1', role: 'PARAMEDIC' });
    const res = await request(app)
      .get('/api/dispatch/incidents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should reject malformed SOS request payload', async () => {
    const res = await request(app)
      .post('/api/public/sos')
      .send({});
    expect(res.status).toBe(400); // Validation error
  });

  it('should accept SOS without auth (but validation error because of missing fields)', async () => {
    // Should hit 400 validation rather than 401 unauth
    const res = await request(app).post('/api/public/sos').send({});
    expect(res.status).toBe(400); 
  });
});
