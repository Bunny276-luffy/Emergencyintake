export interface DispatchAssignmentRequest {
  incidentId: string;
  ambulanceId: string;
  hospitalId?: string;
  notes?: string;
}

export interface DispatchRerouteRequest {
  incidentId: string;
  ambulanceId: string;
  newHospitalId: string;
  reason: string;
}
