import { logger } from '../utils/logger';

interface MLTriageRequest {
  age: number;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  respiratory_rate: number;
  temperature: number;
  gcs: number;
  bleeding: boolean;
  breathing_difficulty: boolean;
  chest_pain: boolean;
  injury_severity: number;
  incident_type: string;
}

interface MLTriageResponse {
  severity_class: string;
  confidence: number;
  model_version: string;
  synthetic_model: boolean;
  safety_escalation: boolean;
  top_factors: string[];
}

export interface MLEtaRequest {
  distance_km: number;
  route_distance_km: number;
  time_of_day: number;
  day_of_week: number;
  traffic_factor: number;
  average_speed_kmh: number;
  road_complexity: number;
  weather_factor: number;
  ambulance_load_factor: number;
  pickup_delay_minutes: number;
}

export interface MLEtaResponse {
  predicted_eta_minutes: number;
  model_version: string;
  synthetic_model: boolean;
  prediction_interval: {
    lower: number;
    upper: number;
  };
}

export class MLService {
  private static ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  public static async predictTriage(data: any): Promise<MLTriageResponse | null> {
    try {
      // Map raw clinical inputs to ML expected format with fallback defaults if missing
      const payload: MLTriageRequest = {
        age: data.age || 45,
        heart_rate: data.heartRate || 80,
        spo2: data.oxygenSaturation || 98,
        systolic_bp: data.bloodPressureSystolic || 120,
        respiratory_rate: data.respiratoryRate || 16,
        temperature: data.temperatureCelsius || 37.0,
        gcs: data.glasgowComaScale || 15,
        bleeding: data.patientConditionSummary?.toLowerCase().includes('bleed') || false,
        breathing_difficulty: data.patientConditionSummary?.toLowerCase().includes('breath') || false,
        chest_pain: data.patientConditionSummary?.toLowerCase().includes('chest') || false,
        injury_severity: 3, // Default if unknown
        incident_type: data.incidentType || 'MEDICAL',
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

      const response = await fetch(`${this.ML_SERVICE_URL}/predict/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`ML Service returned status ${response.status}`);
        return null; // Don't break emergency flow
      }

      const result: MLTriageResponse = await response.json();
      return result;

    } catch (error) {
      logger.error('ML Service prediction failed', { error: error instanceof Error ? error.message : error });
      // Return null, continue normal workflow without ML
      return null;
    }
  }

  public static async predictETA(payload: MLEtaRequest): Promise<MLEtaResponse | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

      const response = await fetch(`${this.ML_SERVICE_URL}/predict/eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`ML Service ETA returned status ${response.status}`);
        return null;
      }

      const result: MLEtaResponse = await response.json();
      return result;

    } catch (error) {
      logger.error('ML Service ETA prediction failed', { error: error instanceof Error ? error.message : error });
      // Return null, continue normal workflow
      return null;
    }
  }
}
