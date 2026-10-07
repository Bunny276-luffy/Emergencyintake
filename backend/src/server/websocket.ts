import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { SystemErrorRecord } from '../errors/ErrorSeverity';
import { AuditLogEntry, EmergencyIncident, Ambulance, ParamedicReport, BedReservation } from '../types';
import jwt from 'jsonwebtoken';
import { AuthorizationService } from '../services/AuthorizationService';

const JWT_SECRET = process.env.JWT_SECRET || 'emergency_super_secret_key_123!';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
  };
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private io: SocketIOServer | null = null;

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public initialize(server: HttpServer, corsOrigin = '*'): SocketIOServer {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST', 'PATCH'],
      },
    });

    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`[WEBSOCKET_CONNECT] Client connected: ${socket.id} (User: ${socket.user?.id})`);

      socket.on('join_dispatcher_room', () => {
        if (socket.user?.role === 'ADMIN' || socket.user?.role === 'DISPATCHER') {
          socket.join('dispatcher-room');
          logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined 'dispatcher-room'`);
          socket.emit('room_joined', { room: 'dispatcher-room' });
        } else {
          socket.emit('room_error', { message: 'Unauthorized for dispatcher room' });
        }
      });

      socket.on('join_ambulance_room', async (data: { ambulanceId: string }) => {
        if (data?.ambulanceId && socket.user) {
          const canAccess = await AuthorizationService.canAccessAmbulance(socket.user, data.ambulanceId);
          if (canAccess) {
            const room = `ambulance-room:${data.ambulanceId}`;
            socket.join(room);
            logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined '${room}'`);
            socket.emit('room_joined', { room });
          } else {
            socket.emit('room_error', { message: 'Unauthorized for ambulance room' });
          }
        }
      });

      socket.on('join_paramedic_room', async (data?: { incidentId?: string }) => {
        if (socket.user?.role === 'ADMIN' || socket.user?.role === 'DISPATCHER' || socket.user?.role === 'PARAMEDIC') {
          // Broad paramedic team room
          socket.join('paramedic-team-room');
          logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined 'paramedic-team-room'`);
          socket.emit('room_joined', { room: 'paramedic-team-room' });

          // Specific incident room
          if (data?.incidentId) {
            const canAccess = await AuthorizationService.canAccessIncident(socket.user, data.incidentId);
            if (canAccess) {
              const room = `paramedic-room:${data.incidentId}`;
              socket.join(room);
              logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined '${room}'`);
              socket.emit('room_joined', { room });
            } else {
              socket.emit('room_error', { message: 'Unauthorized for incident room' });
            }
          }
        } else {
          socket.emit('room_error', { message: 'Unauthorized for paramedic rooms' });
        }
      });

      socket.on('join_hospital_room', async (data: { hospitalId: string }) => {
        if (data?.hospitalId && socket.user) {
          const canAccess = await AuthorizationService.canAccessHospital(socket.user, data.hospitalId);
          if (canAccess) {
            const room = `hospital-room:${data.hospitalId}`;
            socket.join(room);
            logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined '${room}'`);
            socket.emit('room_joined', { room });
          } else {
            socket.emit('room_error', { message: 'Unauthorized for hospital room' });
          }
        }
      });

      socket.on('join_admin_room', () => {
        if (socket.user?.role === 'ADMIN') {
          socket.join('admin-room');
          logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} joined 'admin-room'`);
          socket.emit('room_joined', { room: 'admin-room' });
        } else {
          socket.emit('room_error', { message: 'Unauthorized for admin room' });
        }
      });

      socket.on('leave_room', (data: { room: string }) => {
        if (data?.room) {
          socket.leave(data.room);
          logger.info(`[WEBSOCKET_ROOM] Client ${socket.id} left '${data.room}'`);
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info(`[WEBSOCKET_DISCONNECT] Client disconnected ${socket.id}. Reason: ${reason}`);
      });
    });

    return this.io;
  }

  public getWebSocketStatus(): { status: 'HEALTHY' | 'UNHEALTHY'; connectedClients: number } {
    if (!this.io) {
      return { status: 'UNHEALTHY', connectedClients: 0 };
    }
    return {
      status: 'HEALTHY',
      connectedClients: this.io.sockets.sockets.size,
    };
  }

  /** Broadcasters for real operational events */

  public broadcastIncidentCreated(incident: EmergencyIncident): void {
    if (!this.io) return;
    this.io.to('dispatcher-room').to('admin-room').emit('INCIDENT_CREATED', incident);
  }

  public broadcastAmbulanceAssigned(data: {
    incidentId: string;
    ambulanceId: string;
    hospitalId?: string;
  }): void {
    if (!this.io) return;
    const ambRoom = `ambulance-room:${data.ambulanceId}`;
    const paramRoom = `paramedic-room:${data.incidentId}`;
    this.io.to(ambRoom).to('dispatcher-room').to('admin-room').to(paramRoom).emit('AMBULANCE_ASSIGNED', data);
  }

  public broadcastAmbulanceLocation(data: {
    ambulanceId: string;
    latitude: number;
    longitude: number;
  }): void {
    if (!this.io) return;
    const ambRoom = `ambulance-room:${data.ambulanceId}`;
    this.io.to(ambRoom).to('dispatcher-room').to('admin-room').emit('AMBULANCE_LOCATION_UPDATED', data);
  }

  public broadcastAmbulanceStatus(data: {
    ambulanceId: string;
    status: string;
    incidentId?: string;
    hospitalId?: string;
  }): void {
    if (!this.io) return;
    const ambRoom = `ambulance-room:${data.ambulanceId}`;
    let emitter = this.io.to(ambRoom).to('dispatcher-room').to('admin-room');
    if (data.incidentId) {
      emitter = emitter.to(`paramedic-room:${data.incidentId}`);
    }
    if (data.hospitalId) {
      emitter = emitter.to(`hospital-room:${data.hospitalId}`);
    }
    emitter.emit('AMBULANCE_STATUS_UPDATED', data);
  }

  public broadcastClinicalReport(report: ParamedicReport, hospitalId?: string): void {
    if (!this.io) return;
    const paramRoom = `paramedic-room:${report.incidentId}`;
    let emitter = this.io.to(paramRoom).to('dispatcher-room').to('admin-room');
    if (hospitalId) {
      emitter = emitter.to(`hospital-room:${hospitalId}`);
    }
    emitter.emit('CLINICAL_REPORT_SUBMITTED', report);
  }

  public broadcastReservationRequested(reservation: BedReservation): void {
    if (!this.io) return;
    const hospRoom = `hospital-room:${reservation.hospitalId}`;
    this.io.to(hospRoom).to('admin-room').emit('RESERVATION_REQUESTED', reservation);
  }

  public broadcastReservationDecision(reservation: BedReservation, ambulanceId?: string): void {
    if (!this.io) return;
    const eventName = reservation.status === 'CONFIRMED' ? 'RESERVATION_ACCEPTED' : 'RESERVATION_REJECTED';
    let emitter = this.io.to('dispatcher-room').to('admin-room');
    if (ambulanceId) {
      emitter = emitter.to(`ambulance-room:${ambulanceId}`);
    }
    emitter.emit(eventName, reservation);
  }

  public broadcastReroute(data: {
    incidentId: string;
    ambulanceId: string;
    newHospitalId: string;
    reason: string;
  }): void {
    if (!this.io) return;
    const ambRoom = `ambulance-room:${data.ambulanceId}`;
    const hospRoom = `hospital-room:${data.newHospitalId}`;
    this.io.to(ambRoom).to(hospRoom).to('dispatcher-room').to('admin-room').emit('REROUTE_EXECUTED', data);
  }

  public broadcastHandoffCompleted(data: {
    incidentId: string;
    ambulanceId: string;
    hospitalId?: string;
  }): void {
    if (!this.io) return;
    let emitter = this.io.to('dispatcher-room').to('admin-room');
    if (data.incidentId) {
      emitter = emitter.to(`paramedic-room:${data.incidentId}`);
    }
    if (data.hospitalId) {
      emitter = emitter.to(`hospital-room:${data.hospitalId}`);
    }
    emitter.emit('HANDOFF_COMPLETED', data);
  }

  public broadcastSystemError(errorRecord: SystemErrorRecord): void {
    if (!this.io) return;
    this.io.to('admin-room').emit('SYSTEM_ERROR_LOGGED', errorRecord);
  }

  public broadcastAuditEvent(auditEntry: AuditLogEntry): void {
    if (!this.io) return;
    this.io.to('admin-room').emit('AUDIT_EVENT_LOGGED', auditEntry);
  }

  public broadcastHospitalCapacityChanged(data: { hospitalId: string; capacity: any }): void {
    if (!this.io) return;
    const hospRoom = `hospital-room:${data.hospitalId}`;
    this.io.to(hospRoom).to('dispatcher-room').to('admin-room').emit('HOSPITAL_CAPACITY_CHANGED', data);
  }

  public broadcastAutoDispatch(data: any): void {
    if (!this.io) return;
    let emitter = this.io.to('dispatcher-room').to('admin-room');
    if (data?.incidentId) {
      emitter = emitter.to(`paramedic-room:${data.incidentId}`);
    }
    emitter.emit('AUTOMATIC_DISPATCH_EXECUTED', data);
  }
}

export const webSocketManager = WebSocketManager.getInstance();
