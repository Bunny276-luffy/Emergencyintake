export type HealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'DISCONNECTED'
  | 'NOT_CONFIGURED'
  | 'SERVICE_UNAVAILABLE';

export interface ComponentHealthStatus {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthReport {
  timestamp: string;
  uptimeSeconds: number;
  overallStatus: HealthStatus;
  components: {
    backend: ComponentHealthStatus;
    database: ComponentHealthStatus;
    apiGateway: ComponentHealthStatus;
    webSocket: ComponentHealthStatus;
    routingService?: ComponentHealthStatus;
    aiService: ComponentHealthStatus;
  };
}
