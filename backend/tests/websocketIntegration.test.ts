import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/server/app';
import { webSocketManager } from '../src/server/websocket';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { dbService } from '../src/config/database';
import { ambulanceRepository } from '../src/repositories/AmbulanceRepository';
const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';
const generateToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

describe('WebSocket Integration End-to-End Tests', () => {
  const originalEnv = process.env.DISABLE_AUTO_DISPATCH;

  let httpServer: http.Server;
  let port: number;
  let dispatcherSocket: ClientSocketType;
  let driverASocket: ClientSocketType;
  let driverBSocket: ClientSocketType;
  
  let ambulanceA: any;
  let ambulanceB: any;
  let dispatcherToken: string;
  let driverAToken: string;
  let driverBToken: string;

  beforeAll((done) => {
    process.env.DISABLE_AUTO_DISPATCH = 'true';
    httpServer = http.createServer(app);
    webSocketManager.initialize(httpServer, '*');
    httpServer.listen(0, async () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      
      await dbService.checkDatabaseHealth();
      
      // Setup mock data
      ambulanceA = await ambulanceRepository.create({
        vehicleNumber: `TEST-AMB-A-${Date.now()}`, driverName: 'Driver A', driverPhone: '1', status: 'AVAILABLE'
      });
      ambulanceB = await ambulanceRepository.create({
        vehicleNumber: `TEST-AMB-B-${Date.now()}`, driverName: 'Driver B', driverPhone: '2', status: 'AVAILABLE'
      });
      
      const userA = await prisma.user.create({
        data: { username: `Driver A ${Date.now()}`, role: 'AMBULANCE_DRIVER', ambulanceId: ambulanceA.id, passwordHash: 'x' }
      });
      const userB = await prisma.user.create({
        data: { username: `Driver B ${Date.now()}`, role: 'AMBULANCE_DRIVER', ambulanceId: ambulanceB.id, passwordHash: 'x' }
      });

      dispatcherToken = generateToken({ id: 'disp1', role: 'DISPATCHER' });
      driverAToken = generateToken({ id: userA.id, role: 'AMBULANCE_DRIVER' });
      driverBToken = generateToken({ id: userB.id, role: 'AMBULANCE_DRIVER' });
      
      done();
    });
  });

  afterAll(async () => {
    if (originalEnv !== undefined) {
      process.env.DISABLE_AUTO_DISPATCH = originalEnv;
    } else {
      delete process.env.DISABLE_AUTO_DISPATCH;
    }
    dispatcherSocket?.disconnect();
    driverASocket?.disconnect();
    driverBSocket?.disconnect();
    httpServer.close();
    
    // Cleanup mock data
    await prisma.user.deleteMany({ where: { role: 'AMBULANCE_DRIVER', passwordHash: 'x' } });
    await prisma.ambulance.deleteMany({ where: { id: { in: [ambulanceA.id, ambulanceB.id] } } });
    await dbService.disconnect();
  });

  const createSocket = (token: string, onConnect: (s: ClientSocketType) => void) => {
    const s = ClientSocket(`http://localhost:${port}`, {
      auth: { token },
      reconnection: false,
    });
    s.on('connect', () => onConnect(s));
    return s;
  };

  it('End-to-End: Dispatcher receives incident on SOS', (done) => {
    dispatcherSocket = createSocket(dispatcherToken, (socket) => {
      socket.emit('join_dispatcher_room');
    });

    dispatcherSocket.on('room_joined', () => {
      // Dispatcher is ready. Let's trigger SOS.
      request(app)
        .post('/api/public/sos')
        .send({
          emergencyType: 'ACCIDENT',
          location: { latitude: 12.9, longitude: 77.5 },
          description: 'Car crash',
          reporterContact: '+919999999999'
        })
        .then(res => {
          expect(res.status).toBe(201);
        });
    });

    dispatcherSocket.once('INCIDENT_CREATED', (incident) => {
      expect(incident.emergencyType).toBe('ACCIDENT');
      expect(incident.description).toBe('Car crash');
      done();
    });
  });

  it('End-to-End: Ambulance assignment routes to specific driver', (done) => {
    let aReceived = false;
    let bReceived = false;

    // We already have a real incident from previous test? Actually we'll create a new one via API
    let createdIncidentId: string;

    driverASocket = createSocket(driverAToken, (socket) => {
      socket.emit('join_ambulance_room', { ambulanceId: ambulanceA.id });
    });
    driverBSocket = createSocket(driverBToken, (socket) => {
      socket.emit('join_ambulance_room', { ambulanceId: ambulanceB.id });
    });

    driverASocket.on('AMBULANCE_ASSIGNED', (data) => {
      expect(data.ambulanceId).toBe(ambulanceA.id);
      aReceived = true;
      if (aReceived) {
        // give B some time to NOT receive it
        setTimeout(() => {
          expect(bReceived).toBe(false);
          done();
        }, 100);
      }
    });

    driverBSocket.on('AMBULANCE_ASSIGNED', () => {
      bReceived = true;
    });

    // Wait for drivers to join rooms
    setTimeout(async () => {
      try {
        const sosRes = await request(app)
          .post('/api/public/sos')
          .send({
            emergencyType: 'STEMI',
            location: { latitude: 12.9, longitude: 77.5 },
            description: 'Heart attack',
          });
        expect(sosRes.status).toBe(201);
        createdIncidentId = sosRes.body.data ? sosRes.body.data.incident.id : sosRes.body.incident.id;

        const assignRes = await request(app)
          .post('/api/dispatch/assign')
          .set('Authorization', `Bearer ${dispatcherToken}`)
          .send({
            incidentId: createdIncidentId,
            ambulanceId: ambulanceA.id
          });
        if (assignRes.status !== 200) console.error('ASSIGN FAILED', assignRes.body);
        expect(assignRes.status).toBe(200);
      } catch (e) {
        done(e);
      }
    }, 200);
  });
});
