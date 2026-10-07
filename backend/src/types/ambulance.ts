import { LocationCoordinates } from './incident';

export type AmbulanceStatus = 'AVAILABLE' | 'ASSIGNED' | 'EN_ROUTE' | 'OUT_OF_SERVICE' | 'MAINTENANCE';

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

export interface AmbulanceAssignmentDTO {
  ambulanceId: string;
  incidentId: string;
  pickupLocation: LocationCoordinates;
  destinationHospitalId: string;
}
