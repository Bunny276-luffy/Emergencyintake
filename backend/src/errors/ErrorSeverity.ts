export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export type SystemErrorSource =
  | 'PUBLIC_SOS'
  | 'AMBULANCE_DRIVER'
  | 'PARAMEDIC_TEAM'
  | 'HOSPITAL'
  | 'DISPATCH_CENTER'
  | 'ADMIN_COMMAND_CENTER'
  | 'DATABASE'
  | 'API_GATEWAY'
  | 'WEBSOCKET'
  | 'AI_SERVICE'
  | 'ROUTING_SERVICE'
  | 'SYSTEM_CORE';

export interface SystemErrorRecord {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  source: SystemErrorSource;
  service: string;
  operation: string;
  message: string;
  details?: Record<string, unknown>;
  incidentId?: string;
  ambulanceId?: string;
  hospitalId?: string;
  resolved: boolean;
  resolvedAt?: string;
}
