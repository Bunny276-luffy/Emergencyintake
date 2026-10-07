import type {
  EmergencyIncident,
  Ambulance,
  Hospital,
  ParamedicReport,
  BedReservation,
  SystemHealthReport,
  SystemErrorRecord,
  AuditLogEntry,
  AmbulanceStatus,
} from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;
  const token = localStorage.getItem('auth_token');
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      ...options,
    });
  } catch (err: any) {
    throw new Error(`Emergency AI Core backend service is unreachable at ${API_BASE_URL}. Ensure backend dev server is running on port 5000.`);
  }

  const data = await response.json();
  if (!response.ok || !data.success) {
    const errorMsg = data.error?.message || data.message || `API request failed with status ${response.status}`;
    
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('api:unauthorized'));
    } else if (response.status === 403) {
      window.dispatchEvent(new CustomEvent('api:forbidden', { detail: errorMsg }));
    } else if (response.status === 429) {
      window.dispatchEvent(new CustomEvent('api:ratelimit', { detail: errorMsg }));
    }
    
    throw new Error(errorMsg);
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) => 
    fetchJSON<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  // Public SOS
  createPublicSOS: (payload: {
    emergencyType: string;
    location: { latitude: number; longitude: number; address?: string };
    description: string;
    reporterContact?: string;
    patientInfo?: {
      name?: string;
      age?: number;
      gender?: 'MALE' | 'FEMALE' | 'OTHER';
      knownMedicalConditions?: string[];
      allergies?: string[];
      bloodType?: string;
    };
  }) => fetchJSON<{ incident: EmergencyIncident; patient?: any }>('/public/sos', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getPublicIncident: (incidentId: string) =>
    fetchJSON<EmergencyIncident>(`/public/incident/${incidentId}`),

  // Ambulance Driver
  getAmbulanceStatus: (ambulanceId: string) =>
    fetchJSON<Ambulance>(`/ambulance/${ambulanceId}/status`),

  getAmbulanceAssignment: (ambulanceId: string) =>
    fetchJSON<{ ambulance: Ambulance; incident?: EmergencyIncident }>(`/ambulance/${ambulanceId}/assignment`),

  updateAmbulanceLocation: (ambulanceId: string, latitude: number, longitude: number) =>
    fetchJSON<Ambulance>(`/ambulance/${ambulanceId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    }),

  updateAmbulanceStatus: (ambulanceId: string, status: AmbulanceStatus) =>
    fetchJSON<Ambulance>(`/ambulance/${ambulanceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  acknowledgeAmbulanceAssignment: (ambulanceId: string) =>
    fetchJSON<Ambulance>(`/ambulance/${ambulanceId}/acknowledge`, { method: 'POST' }),

  reportPatientArrival: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/arrive-patient`, { method: 'POST' }),
  arriveAtPatient: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/arrive-patient`, { method: 'POST' }),

  reportPatientDeparture: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/depart-patient`, { method: 'POST' }),
  departWithPatient: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/depart-patient`, { method: 'POST' }),

  reportHospitalArrival: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/arrive-hospital`, { method: 'POST' }),
  arriveAtHospital: (ambulanceId: string) =>
    fetchJSON<EmergencyIncident>(`/ambulance/${ambulanceId}/arrive-hospital`, { method: 'POST' }),

  completeHandoff: (ambulanceId: string) =>
    fetchJSON<{ ambulance: Ambulance; incident: EmergencyIncident }>(`/ambulance/${ambulanceId}/handoff-complete`, { method: 'POST' }),
  completeHospitalHandoff: (ambulanceId: string) =>
    fetchJSON<{ ambulance: Ambulance; incident: EmergencyIncident }>(`/ambulance/${ambulanceId}/handoff-complete`, { method: 'POST' }),

  // Paramedic Team
  getAssignedParamedicIncident: (incidentId: string) =>
    fetchJSON<{ incident: EmergencyIncident; patient?: any; report?: ParamedicReport }>(`/paramedic/incident/${incidentId}`),

  submitClinicalReport: (payload: {
    incidentId: string;
    patientConditionSummary: string;
    triageLevel: string;
    vitals: any;
    voiceReportAudioUrl?: string;
  }) => fetchJSON<ParamedicReport>('/paramedic/report', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getClinicalReport: (incidentId: string) =>
    fetchJSON<ParamedicReport>(`/paramedic/report/${incidentId}`),

  structureVoiceReportAI: (audioUrl?: string, rawNotes?: string) =>
    fetchJSON<any>('/paramedic/ai/structure-report', {
      method: 'POST',
      body: JSON.stringify({ audioUrl, rawNotes }),
    }),

  // Hospital ER
  getHospitalProfile: (hospitalId: string) =>
    fetchJSON<Hospital>(`/hospital/${hospitalId}/profile`),

  updateHospitalCapacity: (hospitalId: string, capacityInfo: any) =>
    fetchJSON<Hospital>(`/hospital/${hospitalId}/capacity`, {
      method: 'PATCH',
      body: JSON.stringify(capacityInfo),
    }),

  getHospitalReservations: (hospitalId: string) =>
    fetchJSON<BedReservation[]>(`/hospital/${hospitalId}/reservations`),

  acceptHospitalReservation: (hospitalId: string, reservationId: string) =>
    fetchJSON<BedReservation>(`/hospital/${hospitalId}/reservation/${reservationId}/accept`, { method: 'POST' }),

  rejectHospitalReservation: (hospitalId: string, reservationId: string, reason: string) =>
    fetchJSON<BedReservation>(`/hospital/${hospitalId}/reservation/${reservationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  generateHospitalPreArrivalSummary: (hospitalId: string, incidentId: string) =>
    fetchJSON<any>(`/hospital/${hospitalId}/incident/${incidentId}/ai-summary`),

  // 108 Dispatch Center
  listActiveIncidents: () => fetchJSON<EmergencyIncident[]>('/dispatch/incidents'),

  getIncidentDetails: (incidentId: string) => fetchJSON<any>(`/dispatch/incident/${incidentId}`),

  listAvailableAmbulances: () => fetchJSON<Ambulance[]>('/dispatch/ambulances/available'),

  findNearestAmbulances: (latitude: number, longitude: number, radiusMeters = 50000) =>
    fetchJSON<Array<{ ambulanceId: string; distanceMeters: number }>>(
      `/dispatch/ambulances/nearest?latitude=${latitude}&longitude=${longitude}&radiusMeters=${radiusMeters}`
    ),

  assignAmbulance: (incidentId: string, ambulanceId: string, hospitalId?: string, notes?: string) =>
    fetchJSON<{ success: boolean; message: string }>('/dispatch/assign', {
      method: 'POST',
      body: JSON.stringify({ incidentId, ambulanceId, hospitalId, notes }),
    }),

  findCandidateHospitals: async (latitude: number, longitude: number, requiredBedType = 'EMERGENCY', radiusMeters = 50000) => {
    const raw = await fetchJSON<any[]>(
      `/dispatch/hospitals/candidate?latitude=${latitude}&longitude=${longitude}&requiredBedType=${requiredBedType}&radiusMeters=${radiusMeters}`
    );
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => {
      const h = item?.hospital ? item.hospital : item;
      return {
        ...h,
        distanceMeters: item?.distanceMeters ?? h?.distanceMeters,
      };
    });
  },

  createHospitalReservation: (incidentId: string, hospitalId: string, bedType = 'EMERGENCY') =>
    fetchJSON<BedReservation>('/dispatch/reservation', {
      method: 'POST',
      body: JSON.stringify({ incidentId, hospitalId, bedType }),
    }),

  executeReroute: (incidentId: string, ambulanceId: string, newHospitalId: string, reason: string) =>
    fetchJSON<{ success: boolean; message: string }>('/dispatch/reroute', {
      method: 'POST',
      body: JSON.stringify({ incidentId, ambulanceId, newHospitalId, reason }),
    }),

  getIncidentTimeline: (incidentId: string) =>
    fetchJSON<AuditLogEntry[]>(`/dispatch/incident/${incidentId}/timeline`),

  // Admin Command Center
  getAdminHealth: () => fetchJSON<SystemHealthReport>('/admin/health'),

  getAdminErrors: (severity?: string, resolved?: boolean) => {
    let url = '/admin/errors';
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (resolved !== undefined) params.append('resolved', String(resolved));
    if (params.toString()) url += `?${params.toString()}`;
    return fetchJSON<SystemErrorRecord[]>(url);
  },

  resolveAdminError: (errorId: string) =>
    fetchJSON<{ success: boolean; message: string }>(`/admin/errors/${errorId}/resolve`, { method: 'PATCH' }),

  getAdminAudit: () => fetchJSON<AuditLogEntry[]>('/admin/audit'),

  getAdminStats: () => fetchJSON<any>('/admin/stats'),

  getAdminFleet: () => fetchJSON<Ambulance[]>('/admin/ambulances'),

  getAdminHospitals: () => fetchJSON<Hospital[]>('/admin/hospitals'),
};
