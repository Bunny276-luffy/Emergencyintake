from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_eta_valid():
    payload = {
        "distance_km": 10.5,
        "route_distance_km": 12.2,
        "time_of_day": 14.5,
        "day_of_week": 3,
        "traffic_factor": 1.2,
        "average_speed_kmh": 40.0,
        "road_complexity": 3,
        "weather_factor": 1.0,
        "ambulance_load_factor": 0.5,
        "pickup_delay_minutes": 2.0
    }
    
    response = client.post("/predict/eta", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_eta_minutes" in data
    assert "prediction_interval" in data
    assert data["prediction_interval"]["lower"] <= data["prediction_interval"]["upper"]
    assert data["predicted_eta_minutes"] >= 1.0

def test_eta_invalid_input():
    payload = {
        "distance_km": -5.0, # invalid
        "route_distance_km": 12.2,
        "time_of_day": 14.5,
        "day_of_week": 3,
        "traffic_factor": 1.2,
        "average_speed_kmh": 40.0,
        "road_complexity": 3,
        "weather_factor": 1.0,
        "ambulance_load_factor": 0.5,
        "pickup_delay_minutes": 2.0
    }
    
    response = client.post("/predict/eta", json=payload)
    assert response.status_code == 422 # Pydantic validation error

def test_eta_missing_fields():
    payload = {
        "distance_km": 10.5
        # Missing others
    }
    
    response = client.post("/predict/eta", json=payload)
    assert response.status_code == 422
