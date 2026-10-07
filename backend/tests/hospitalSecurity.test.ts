import request from 'supertest';
import express from 'express';
import hospitalRoutes from '../src/routes/hospitalRoutes';
import { authenticate, requireRole } from '../src/middleware/authHandler';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/hospital', hospitalRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';

const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Hospital Security Tests', () => {
  it('should reject anonymous requests with 401', async () => {
    const res = await request(app).get('/api/hospital/H1/profile');
    expect(res.status).toBe(401);
  });

  it('should reject invalid JWT with 403', async () => {
    const res = await request(app)
      .get('/api/hospital/H1/profile')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401);
  });

  it('should reject a role that is not hospital, dispatcher, or admin', async () => {
    const token = generateToken({ id: 'driver1', role: 'AMBULANCE_DRIVER' });
    const res = await request(app)
      .get('/api/hospital/H1/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
