import { MLService } from '../src/services/MLService';

describe('Phase 2B: ML ETA Integration', () => {
  const mockETARequest = {
    distance_km: 8.4,
    route_distance_km: 10.1,
    time_of_day: 18.5,
    day_of_week: 2,
    traffic_factor: 1.3,
    average_speed_kmh: 31,
    road_complexity: 2,
    weather_factor: 1.0,
    ambulance_load_factor: 0.2,
    pickup_delay_minutes: 1
  };

  it('MLService predictETA handles fetch failures safely and returns null', async () => {
    // Override the ML URL to a non-existent port to force connection error
    const originalUrl = (MLService as any).ML_SERVICE_URL;
    (MLService as any).ML_SERVICE_URL = 'http://localhost:59999';

    const result = await MLService.predictETA(mockETARequest);
    
    // Should gracefully fail and return null
    expect(result).toBeNull();

    // Restore
    (MLService as any).ML_SERVICE_URL = originalUrl;
  });

  it('MLService predictETA safely formats output for ML payload', async () => {
    // Mock fetch to simulate a real response
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        predicted_eta_minutes: 9.4,
        model_version: 'eta-v1',
        synthetic_model: true,
        prediction_interval: {
          lower: 4.4,
          upper: 14.4
        }
      })
    });
    global.fetch = mockFetch as any;

    const result = await MLService.predictETA(mockETARequest);

    expect(result).not.toBeNull();
    expect(result?.predicted_eta_minutes).toBe(9.4);
    expect(result?.prediction_interval.lower).toBe(4.4);

    const calledPayload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(calledPayload.distance_km).toBe(8.4);
    expect(calledPayload.average_speed_kmh).toBe(31);

    // cleanup
    global.fetch = undefined as any;
  });
});
