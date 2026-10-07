export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentStatus =
  | 'REPORTED'
  | 'DISPATCHED'
  | 'PARAMEDIC_EN_ROUTE'
  | 'PATIENT_PICKED_UP'
  | 'TRANSPORTING'
  | 'ARRIVED_AT_HOSPITAL'
  | 'HANDOFF_COMPLETED'
  | 'CANCELLED';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface EmergencyIncident {
  id: string;
  emergencyType: string;
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
  idempotencyKey?: string;
  mlTriagePrediction?: any;
  mlETAPrediction?: any;
}

export interface CreateIncidentDTO {
  emergencyType: string;
  location: LocationCoordinates;
  description: string;
  reporterContact?: string;
  idempotencyKey?: string;
}
