import request from 'supertest';
import { app } from '../src/server/app';

describe('Health Monitoring Foundation with Database & WebSocket Integration', () => {
  it('GET /health should return 200 OK with real system component statuses', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.components.backend.status).toBe('HEALTHY');
    expect(['HEALTHY', 'UNHEALTHY', 'DISCONNECTED']).toContain(
      res.body.data.components.database.status
    );
    expect(['HEALTHY', 'UNHEALTHY']).toContain(
      res.body.data.components.webSocket.status
    );
    expect(['NOT_CONFIGURED', 'HEALTHY']).toContain(
      res.body.data.components.aiService.status
    );
  });

  it('GET /api/health should return 200 OK via API router', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.components.apiGateway.status).toBe('HEALTHY');
  });
});
