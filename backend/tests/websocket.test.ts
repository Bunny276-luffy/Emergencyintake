import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/server/app';
import { webSocketManager } from '../src/server/websocket';
import request from 'supertest';
import { systemErrorRegistry } from '../src/errors/SystemErrorLogger';
import { ErrorSeverity } from '../src/errors/ErrorSeverity';

describe('Phase 4: WebSocket Real-Time Event Architecture', () => {
  let httpServer: http.Server;
  let clientSocket: ClientSocketType;
  let adminSocket: ClientSocketType;
  let port: number;
  let dispatcherToken: string;
  let adminToken: string;
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
  const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  beforeAll((done) => {
    httpServer = http.createServer(app);
    webSocketManager.initialize(httpServer, '*');
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      dispatcherToken = generateToken({ id: 'disp1', role: 'DISPATCHER' });
      adminToken = generateToken({ id: 'admin1', role: 'ADMIN' });
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) clientSocket.disconnect();
    if (adminSocket && adminSocket.connected) adminSocket.disconnect();
    httpServer.close(done);
  });

  it('WebSocket Server Health check - should report HEALTHY status', async () => {
    const status = webSocketManager.getWebSocketStatus();
    expect(status.status).toBe('HEALTHY');
  });

  it('Client should connect and join dispatcher-room', (done) => {
    clientSocket = ClientSocket(`http://localhost:${port}`, { auth: { token: dispatcherToken } });
    clientSocket.on('connect', () => {
      clientSocket.emit('join_dispatcher_room');
    });

    clientSocket.on('room_joined', (data) => {
      expect(data.room).toBe('dispatcher-room');
      done();
    });
  });

  it('Admin client should join admin-room and receive SYSTEM_ERROR_LOGGED event', (done) => {
    adminSocket = ClientSocket(`http://localhost:${port}`, { auth: { token: adminToken } });
    adminSocket.on('connect', () => {
      adminSocket.emit('join_admin_room');
    });

    adminSocket.on('room_joined', (data) => {
      if (data.room === 'admin-room') {
        // Trigger real error via systemErrorRegistry
        systemErrorRegistry.recordError({
          severity: ErrorSeverity.CRITICAL,
          source: 'PARAMEDIC_TEAM',
          service: 'ParamedicService',
          operation: 'TEST_OPERATION',
          message: 'Real test operational error for Admin monitoring',
        });
      }
    });

    adminSocket.on('SYSTEM_ERROR_LOGGED', (errorRecord) => {
      expect(errorRecord.source).toBe('PARAMEDIC_TEAM');
      expect(errorRecord.message).toBe('Real test operational error for Admin monitoring');
      done();
    });
  });

  it('Public SOS API post should trigger real-time INCIDENT_CREATED WebSocket broadcast to Dispatch', (done) => {
    clientSocket.once('INCIDENT_CREATED', (incident) => {
      expect(incident.emergencyType).toBe('STROKE');
      expect(incident.description).toBe('Acute stroke symptoms');
      done();
    });

    request(app)
      .post('/api/public/sos')
      .send({
        emergencyType: 'STROKE',
        location: { latitude: 12.97, longitude: 77.59 },
        description: 'Acute stroke symptoms',
        reporterContact: '+919900011122',
      })
      .then((res) => {
        expect(res.status).toBe(201);
      });
  });
});
