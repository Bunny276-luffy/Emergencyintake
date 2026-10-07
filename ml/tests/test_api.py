from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_triage_valid():
    payload = {
      "age": 45,
      "heart_rate": 120,
      "spo2": 89,
      "systolic_bp": 90,
      "respiratory_rate": 28,
      "temperature": 38.1,
      "gcs": 12,
      "bleeding": True,
      "breathing_difficulty": True,
      "chest_pain": False,
      "injury_severity": 3,
      "incident_type": "TRAUMA"
    }
    response = client.post("/predict/triage", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "severity_class" in data
    assert "confidence" in data
    assert data["model_version"] == "triage-v1"
    assert data["synthetic_model"] is True
    # Should trigger safety escalation because SpO2 < 90, GCS < 13, Bleeding=True
    assert data["safety_escalation"] is True
    
    # Verify model cannot downgrade safety escalation
    assert data["severity_class"] in ["HIGH", "CRITICAL"]

def test_triage_invalid_input():
    payload = {
      "age": -5, # invalid
    }
    response = client.post("/predict/triage", json=payload)
    assert response.status_code == 422 # Unprocessable Entity (Validation Error)
