import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/server/app';
import { webSocketManager } from '../src/server/websocket';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
const generateExpiredToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });

describe('WebSocket Security Tests', () => {
  let httpServer: http.Server;
  let port: number;
  let sockets: ClientSocketType[] = [];

  beforeAll((done) => {
    httpServer = http.createServer(app);
    webSocketManager.initialize(httpServer, '*');
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterAll((done) => {
    sockets.forEach(s => s.connected && s.disconnect());
    httpServer.close(done);
  });

  const createSocket = (token?: string): ClientSocketType => {
    const s = ClientSocket(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(s);
    return s;
  };

  it('no JWT -> connection rejected', (done) => {
    const socket = createSocket();
    socket.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      done();
    });
  });

  it('invalid JWT -> connection rejected', (done) => {
    const socket = createSocket('invalid_token');
    socket.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      done();
    });
  });

  it('expired JWT -> connection rejected', (done) => {
    const socket = createSocket(generateExpiredToken({ id: 'disp1', role: 'DISPATCHER' }));
    socket.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      done();
    });
  });

  it('valid dispatcher -> connection accepted', (done) => {
    const token = generateToken({ id: 'disp1', role: 'DISPATCHER' });
    const socket = createSocket(token);
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      done();
    });
  });

  it('driver cannot join another ambulance room', (done) => {
    // Assuming the DB mock or logic returns false for mismatching ambulance ID.
    // In AuthorizationService, driver can only access if DB matches.
    // For test, since we don't mock DB here easily, we rely on the fact it attempts to hit DB or just fails.
    const token = generateToken({ id: 'user_amb1', role: 'AMBULANCE_DRIVER' });
    const socket = createSocket(token);
    socket.on('connect', () => {
      socket.emit('join_ambulance_room', { ambulanceId: 'AMB-999' });
    });
    socket.on('room_error', (err) => {
      expect(err.message).toMatch(/Unauthorized for ambulance room/);
      done();
    });
  });

  it('unauthorized client cannot join admin room', (done) => {
    const token = generateToken({ id: 'paramedic1', role: 'PARAMEDIC' });
    const socket = createSocket(token);
    socket.on('connect', () => {
      socket.emit('join_admin_room');
    });
    socket.on('room_error', (err) => {
      expect(err.message).toMatch(/Unauthorized for admin room/);
      done();
    });
  });
});
