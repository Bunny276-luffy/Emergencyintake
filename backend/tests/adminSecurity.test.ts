import request from 'supertest';
import express from 'express';
import adminRoutes from '../src/routes/adminRoutes';
import { authenticate, requireRole } from '../src/middleware/authHandler';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Admin Security Tests', () => {
  it('should reject anonymous requests with 401', async () => {
    const res = await request(app).get('/api/admin/health');
    expect(res.status).toBe(401);
  });

  it('should reject a role that is not admin (e.g. dispatcher)', async () => {
    const token = generateToken({ id: 'disp1', role: 'DISPATCHER' });
    const res = await request(app)
      .get('/api/admin/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('should reject a role that is not admin (e.g. paramedic)', async () => {
    const token = generateToken({ id: 'para1', role: 'PARAMEDIC' });
    const res = await request(app)
      .get('/api/admin/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
