from pydantic import BaseModel, Field

class TriageRequest(BaseModel):
    age: int = Field(..., ge=0, le=120)
    heart_rate: int = Field(..., ge=0, le=300)
    spo2: int = Field(..., ge=0, le=100)
    systolic_bp: int = Field(..., ge=0, le=300)
    respiratory_rate: int = Field(..., ge=0, le=100)
    temperature: float = Field(..., ge=20.0, le=45.0)
    gcs: int = Field(..., ge=3, le=15)
    bleeding: bool
    breathing_difficulty: bool
    chest_pain: bool
    injury_severity: int = Field(..., ge=1, le=5)
    incident_type: str

class TriageResponse(BaseModel):
    severity_class: str
    confidence: float
    model_version: str
    synthetic_model: bool = True
    safety_escalation: bool
    top_factors: list[str]

class ETARequest(BaseModel):
    distance_km: float = Field(..., ge=0)
    route_distance_km: float = Field(..., ge=0)
    time_of_day: float = Field(..., ge=0, le=24.0)
    day_of_week: int = Field(..., ge=0, le=6)
    traffic_factor: float = Field(..., ge=0.1)
    average_speed_kmh: float = Field(..., ge=1, le=160)
    road_complexity: int = Field(..., ge=1, le=5)
    weather_factor: float = Field(..., ge=0.5)
    ambulance_load_factor: float = Field(..., ge=0, le=1)
    pickup_delay_minutes: float = Field(..., ge=0)

class ETAPredictionInterval(BaseModel):
    lower: float
    upper: float

class ETAResponse(BaseModel):
    predicted_eta_minutes: float
    model_version: str
    synthetic_model: bool = True
    prediction_interval: ETAPredictionInterval
