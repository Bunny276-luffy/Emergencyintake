import { io, Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  public connect(): Socket {
    if (!this.socket) {
      const token = localStorage.getItem('auth_token');
      this.socket = io(SOCKET_SERVER_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        auth: {
          token
        }
      });

      this.socket.on('connect', () => {
        console.log(`[WEBSOCKET_CLIENT] Connected to Emergency AI Core backend: ${this.socket?.id}`);
      });
      
      this.socket.on('connect_error', (err) => {
        console.error(`[WEBSOCKET_CLIENT] Connection error: ${err.message}`);
      });
      
      this.socket.on('room_error', (err: { message: string }) => {
        console.error(`[WEBSOCKET_CLIENT] Room error: ${err.message}`);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`[WEBSOCKET_CLIENT] Disconnected: ${reason}`);
      });
    }
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public joinDispatcherRoom(): void {
    this.connect().emit('join_dispatcher_room');
  }

  public joinAmbulanceRoom(ambulanceId: string): void {
    this.connect().emit('join_ambulance_room', { ambulanceId });
  }

  public joinParamedicRoom(incidentId: string): void {
    this.connect().emit('join_paramedic_room', { incidentId });
  }

  public joinHospitalRoom(hospitalId: string): void {
    this.connect().emit('join_hospital_room', { hospitalId });
  }

  public joinAdminRoom(): void {
    this.connect().emit('join_admin_room');
  }

  public leaveRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('leave_room', { room });
    }
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    this.connect().on(event, callback);
  }

  public off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
