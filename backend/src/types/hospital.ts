import { LocationCoordinates } from './incident';

export interface CapacityInfo {
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
  capacity: CapacityInfo;
  specialties: string[];
  lastCapacityUpdate: string;
}

export interface HospitalDecisionDTO {
  incidentId: string;
  hospitalId: string;
  decision: 'ACCEPT' | 'REJECT';
  reason?: string;
}
