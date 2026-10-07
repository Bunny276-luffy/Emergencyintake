import request from 'supertest';
import express from 'express';
import paramedicRoutes from '../src/routes/paramedicRoutes';
import dispatchRoutes from '../src/routes/dispatchRoutes';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/paramedic', paramedicRoutes);
app.use('/api/dispatch', dispatchRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Incident & Paramedic Security Tests', () => {
  it('should reject anonymous requests with 401', async () => {
    const res = await request(app).get('/api/paramedic/incident/INC1');
    expect(res.status).toBe(401);
  });

  it('should reject invalid JWT with 403 (or 401 depends on middleware)', async () => {
    const res = await request(app)
      .get('/api/paramedic/incident/INC1')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401); // Assuming authHandler returns 401 on verify fail
  });

  it('should reject a role that is not paramedic, dispatcher, or admin for paramedic routes', async () => {
    const token = generateToken({ id: 'driver1', role: 'AMBULANCE_DRIVER' });
    const res = await request(app)
      .get('/api/paramedic/incident/INC1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should reject a role that is not dispatcher or admin for dispatch routes', async () => {
    const token = generateToken({ id: 'paramedic1', role: 'PARAMEDIC' });
    const res = await request(app)
      .get('/api/dispatch/incidents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
