export interface AuditLogEntry {
  id: string;
  timestamp: string;
  who: string;
  what: string;
  source: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE' | 'PENDING';
  incidentId?: string;
  ambulanceId?: string;
  hospitalId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordAuditInput {
  who: string;
  what: string;
  source: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE' | 'PENDING';
  incidentId?: string;
  ambulanceId?: string;
  hospitalId?: string;
  metadata?: Record<string, unknown>;
}
