import {
  EmergencyIncident,
  Ambulance,
  ParamedicReport,
  Hospital,
  BedReservation,
  AuditLogEntry,
} from '../types';

export interface IBaseRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filter?: Record<string, unknown>): Promise<T[]>;
  create(item: Partial<T>): Promise<T>;
  update(id: ID, item: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

export interface IIncidentRepository extends IBaseRepository<EmergencyIncident> {
  findByStatus(status: string): Promise<EmergencyIncident[]>;
}

export interface IAmbulanceRepository extends IBaseRepository<Ambulance> {
  findAvailable(): Promise<Ambulance[]>;
}

export interface IParamedicRepository extends IBaseRepository<ParamedicReport> {
  findByIncidentId(incidentId: string): Promise<ParamedicReport[]>;
}

export interface IHospitalRepository extends IBaseRepository<Hospital> {
  findAcceptingHospitals(): Promise<Hospital[]>;
}

export interface IReservationRepository extends IBaseRepository<BedReservation> {
  findByIncidentId(incidentId: string): Promise<BedReservation[]>;
}

export interface IAuditRepository {
  recordLog(entry: AuditLogEntry): Promise<AuditLogEntry>;
  queryLogs(filter?: Record<string, unknown>): Promise<AuditLogEntry[]>;
}

export * from './IncidentRepository';
export * from './AmbulanceRepository';
export * from './ParamedicRepository';
export * from './HospitalRepository';
export * from './ReservationRepository';
export * from './SystemErrorRepository';
export * from './AuditRepository';
export * from './TransactionManager';
