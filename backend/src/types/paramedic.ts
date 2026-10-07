export type TriageLevel = 'IMMEDIATE_RED' | 'URGENT_YELLOW' | 'DELAYED_GREEN' | 'EXPECTANT_BLACK';

export interface PatientVitals {
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
  vitals: PatientVitals;
  voiceReportAudioUrl?: string;
  transcriptionText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitParamedicReportDTO {
  incidentId: string;
  patientConditionSummary: string;
  triageLevel: TriageLevel;
  vitals: PatientVitals;
  voiceReportAudioUrl?: string;
}
