import request from 'supertest';
import { app } from '../src/server/app';
import { aiService } from '../src/services/AIService';

describe('Phase 6: AI / Voice / Clinical Intelligence', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
  const paramedicToken = jwt.sign({ id: 'para1', role: 'PARAMEDIC' }, JWT_SECRET, { expiresIn: '12h' });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  it('getAIServiceStatus - should report NOT_CONFIGURED when GEMINI_API_KEY is not set', () => {
    delete process.env.GEMINI_API_KEY;
    const status = aiService.getAIServiceStatus();
    expect(status.status).toBe('NOT_CONFIGURED');
    expect(status.configured).toBe(false);
    expect(status.message).toContain('GEMINI_API_KEY');
  });

  it('structureVoiceClinicalReport - should return real NOT_CONFIGURED state without fake data', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await aiService.structureVoiceClinicalReport(
      'https://storage.emergency.ai/audio/voice-101.wav',
      'Patient with acute shortness of breath'
    );

    expect(result.configured).toBe(false);
    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.structuredReport).toBeUndefined();
  });

  it('POST /api/paramedic/ai/structure-report - should respond with real service status when unconfigured', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app)
      .post('/api/paramedic/ai/structure-report')
      .set('Authorization', `Bearer ${paramedicToken}`)
      .send({
        audioUrl: 'https://storage.emergency.ai/audio/voice-101.wav',
        rawNotes: 'Blunt trauma to head',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.configured).toBe(false);
    expect(res.body.data.status).toBe('NOT_CONFIGURED');
  });

  it('structureVoiceClinicalReport - should handle 503 retry gracefully when configured', async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    const originalFetch = global.fetch;

    try {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Model high demand 503'),
        });
      }) as any;

      const result = await aiService.structureVoiceClinicalReport(
        'https://storage.emergency.ai/audio/voice-101.wav',
        'Test 503 retry'
      );

      expect(callCount).toBe(2);
      expect(result.configured).toBe(true);
      expect(result.status).toBe('SERVICE_UNAVAILABLE');
      expect(result.message).toContain('unavailable');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
