import request from 'supertest';
import express from 'express';
import ambulanceRoutes from '../src/routes/ambulanceRoutes';
import { authenticate, requireRole } from '../src/middleware/authHandler';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(express.json());
app.use('/api/ambulance', ambulanceRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';

const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Ambulance Security Tests', () => {
  it('should reject anonymous requests with 401', async () => {
    const res = await request(app).get('/api/ambulance/A1/status');
    expect(res.status).toBe(401);
  });

  it('should reject invalid JWT with 403', async () => {
    const res = await request(app)
      .get('/api/ambulance/A1/status')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401);
  });

  it('should reject a role that is not driver, dispatcher, or admin', async () => {
    const token = generateToken({ id: 'paramedic1', role: 'PARAMEDIC' });
    const res = await request(app)
      .get('/api/ambulance/A1/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
