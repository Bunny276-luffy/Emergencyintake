export type EmergencyType =
  | 'ACCIDENT'
  | 'STEMI'
  | 'STROKE'
  | 'MAJOR_TRAUMA'
  | 'RESPIRATORY_DISTRESS'
  | 'CARDIAC_ARREST'
  | 'GENERAL_EMERGENCY';

export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'REPORTED'
  | 'DISPATCHED'
  | 'PATIENT_PICKED_UP'
  | 'TRANSPORTING'
  | 'ARRIVED_AT_HOSPITAL'
  | 'HANDOFF_COMPLETED'
  | 'CANCELLED';

export type AmbulanceStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'OUT_OF_SERVICE'
  | 'MAINTENANCE';

export type TriageLevel =
  | 'IMMEDIATE_RED'
  | 'URGENT_YELLOW'
  | 'DELAYED_GREEN'
  | 'EXPECTANT_BLACK';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Patient {
  id: string;
  incidentId: string;
  name?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  knownMedicalConditions: string[];
  allergies: string[];
  bloodType?: string;
}

export interface EmergencyIncident {
  id: string;
  emergencyType: EmergencyType;
  priority: IncidentPriority;
  status: IncidentStatus;
  location: LocationCoordinates;
  description: string;
  reporterContact?: string;
  assignedAmbulanceId?: string;
  assignedParamedicId?: string;
  destinationHospitalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ambulance {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  status: AmbulanceStatus;
  currentLocation?: LocationCoordinates;
  currentIncidentId?: string;
  destinationHospitalId?: string;
  etaSeconds?: number;
  lastUpdated: string;
}

export interface HospitalCapacity {
  totalBeds: number;
  availableICUBeds: number;
  availableEmergencyBeds: number;
  availableVentilators: number;
  traumaCenterLevel: number;
  acceptingPatients: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  location: LocationCoordinates;
  contactNumber: string;
  capacity: HospitalCapacity;
  specialties: string[];
  lastCapacityUpdate: string;
}

export interface ParamedicVitals {
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  temperatureCelsius?: number;
  glasgowComaScale?: number;
  recordedAt: string;
}

export interface ParamedicReport {
  id: string;
  incidentId: string;
  paramedicId: string;
  patientConditionSummary: string;
  triageLevel: TriageLevel;
  vitals: ParamedicVitals;
  voiceReportAudioUrl?: string;
  transcriptionText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BedReservation {
  id: string;
  incidentId: string;
  hospitalId: string;
  bedType: 'EMERGENCY' | 'ICU' | 'GENERAL';
  status: ReservationStatus;
  requestedAt: string;
  confirmedAt?: string;
  expiresAt: string;
}

export interface SystemErrorRecord {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  source: string;
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

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  who: string;
  what: string;
  source: string;
  action: string;
  result: 'SUCCESS' | 'FAILURE';
  incidentId?: string;
  ambulanceId?: string;
  hospitalId?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemHealthReport {
  timestamp: string;
  uptimeSeconds: number;
  overallStatus: string;
  components: Record<string, { status: string; message?: string; details?: Record<string, unknown> }>;
}
