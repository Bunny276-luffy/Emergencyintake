import { SystemHealthReport } from '../types/system';
import { dbService } from '../config/database';
import { webSocketManager } from '../server/websocket';
import { routingService } from './RoutingService';
import { aiService } from './AIService';

export class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  public async getSystemHealth(): Promise<SystemHealthReport> {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const dbHealth = await dbService.checkDatabaseHealth();
    const wsStatus = webSocketManager.getWebSocketStatus();
    const routingStatus = routingService.getRoutingServiceStatus();
    const aiStatus = aiService.getAIServiceStatus();

    const overallStatus =
      dbHealth.status === 'HEALTHY' && wsStatus.status === 'HEALTHY'
        ? 'HEALTHY'
        : 'DEGRADED';

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      overallStatus,
      components: {
        backend: {
          status: 'HEALTHY',
          message: 'Express HTTP Server is operational',
          details: {
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
          },
        },
        database: {
          status: dbHealth.status,
          message: dbHealth.message,
          details: {
            latencyMs: dbHealth.latencyMs,
            postgisVersion: dbHealth.postgisVersion,
          },
        },
        apiGateway: {
          status: 'HEALTHY',
          message: 'API route group infrastructure loaded',
        },
        webSocket: {
          status: wsStatus.status,
          message: wsStatus.status === 'HEALTHY'
            ? `WebSocket real-time server operational (${wsStatus.connectedClients} active clients)`
            : 'WebSocket server offline or initializing',
          details: {
            connectedClients: wsStatus.connectedClients,
          },
        },
        routingService: {
          status: routingStatus.status,
          message: `Routing engine using ${routingStatus.engine}`,
          details: {
            engine: routingStatus.engine,
          },
        },
        aiService: {
          status: aiStatus.status,
          message: aiStatus.message,
          details: {
            provider: aiStatus.provider,
            configured: aiStatus.configured,
          },
        },
      },
    };
  }
}

export const healthService = new HealthService();
