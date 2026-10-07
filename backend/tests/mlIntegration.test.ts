import { MLService } from '../src/services/MLService';
import { prisma } from '../src/config/database';

describe('Phase 2A: ML Integration', () => {
  const mockMLData = {
    age: 45,
    heartRate: 120,
    oxygenSaturation: 89, // critically low
    bloodPressureSystolic: 90,
    respiratoryRate: 28,
    temperatureCelsius: 38.1,
    glasgowComaScale: 12,
    patientConditionSummary: 'Patient has severe bleeding and breathing difficulty after fall',
    incidentType: 'TRAUMA'
  };

  it('MLService handles fetch failures safely and returns null', async () => {
    // Override the ML URL to a non-existent port to force connection error
    const originalUrl = (MLService as any).ML_SERVICE_URL;
    (MLService as any).ML_SERVICE_URL = 'http://localhost:59999';

    const result = await MLService.predictTriage(mockMLData);
    
    // Should gracefully fail and return null
    expect(result).toBeNull();

    // Restore
    (MLService as any).ML_SERVICE_URL = originalUrl;
  });

  it('MLService safely formats output for ML payload', async () => {
    // Just mock fetch to simulate a real response
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        severity_class: 'CRITICAL',
        confidence: 0.95,
        model_version: 'triage-v1',
        synthetic_model: true,
        safety_escalation: true,
        top_factors: ['Low SpO2', 'Elevated heart rate']
      })
    });
    global.fetch = mockFetch as any;

    const result = await MLService.predictTriage(mockMLData);

    expect(result).not.toBeNull();
    expect(result?.severity_class).toBe('CRITICAL');
    expect(result?.safety_escalation).toBe(true);

    const calledPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(calledPayload.spo2).toBe(89);
    expect(calledPayload.bleeding).toBe(true); // Extracted from patientConditionSummary
    expect(calledPayload.breathing_difficulty).toBe(true);

    // cleanup
    global.fetch = undefined as any;
  });
});
