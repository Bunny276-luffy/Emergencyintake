import request from 'supertest';
import express from 'express';
import hospitalRoutes from '../src/routes/hospitalRoutes';
import jwt from 'jsonwebtoken';
import { AuthorizationService } from '../src/services/AuthorizationService';

// Mock Services
jest.mock('../src/services/AuthorizationService');
jest.mock('../src/services/ParamedicService', () => ({
  paramedicService: {
    getAssignedIncident: jest.fn(),
  },
}));
jest.mock('../src/services/AIService', () => ({
  aiService: {
    generatePreArrivalSummary: jest.fn(),
  },
}));

const { paramedicService } = require('../src/services/ParamedicService');
const { aiService } = require('../src/services/AIService');

const app = express();
app.use(express.json());
app.use('/api/hospital', hospitalRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('Hospital AI Pre-Arrival Summary Tests', () => {
  const hospitalToken = generateToken({ id: 'user_h1', role: 'HOSPITAL' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. authorized hospital can request summary', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: { id: 'rep1', patientConditionSummary: 'Trauma' },
      patient: { name: 'John Doe' },
    });
    aiService.generatePreArrivalSummary.mockResolvedValue({
      status: 'SUCCESS',
      structuredSummary: { conditionSeverity: 'CRITICAL', estimatedETA: '10 mins' },
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SUCCESS');
    expect(res.body.data.structuredSummary.conditionSeverity).toBe('CRITICAL');
  });

  it('2. hospital cannot access another hospital\'s incident', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .get('/api/hospital/H2/incident/INC2/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Unauthorized/);
  });

  it('3. valid AI response is returned', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: { id: 'rep1' },
    });
    aiService.generatePreArrivalSummary.mockResolvedValue({
      status: 'SUCCESS',
      structuredSummary: { conditionSeverity: 'MODERATE' },
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.structuredSummary.conditionSeverity).toBe('MODERATE');
  });

  it('4. Gemini timeout returns safe AI-unavailable state', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: { id: 'rep1' },
    });
    aiService.generatePreArrivalSummary.mockResolvedValue({
      status: 'TIMEOUT',
      message: 'Request timed out'
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TIMEOUT');
    expect(res.body.data.structuredSummary).toBeUndefined();
  });

  it('5. malformed AI response is rejected', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: { id: 'rep1' },
    });
    aiService.generatePreArrivalSummary.mockResolvedValue({
      status: 'INVALID_RESPONSE',
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('INVALID_RESPONSE');
  });

  it('6. no fake fallback is returned', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: { id: 'rep1' },
    });
    aiService.generatePreArrivalSummary.mockResolvedValue({
      status: 'SERVICE_UNAVAILABLE',
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.data.structuredSummary).toBeUndefined();
  });

  it('7. returns 400 if no clinical report exists', async () => {
    (AuthorizationService.canAccessIncident as jest.Mock).mockResolvedValue(true);
    paramedicService.getAssignedIncident.mockResolvedValue({
      report: null, // No report yet
    });

    const res = await request(app)
      .get('/api/hospital/H1/incident/INC1/ai-summary')
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
