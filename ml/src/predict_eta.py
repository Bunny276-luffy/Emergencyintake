import os
import joblib
import json
import pandas as pd
import numpy as np
from src.schemas import ETARequest, ETAResponse, ETAPredictionInterval

# Cache model and metadata
_model = None
_metadata = None

def get_eta_model():
    global _model, _metadata
    if _model is None:
        models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
        model_path = os.path.join(models_dir, "eta-v1.joblib")
        meta_path = os.path.join(models_dir, "eta_metrics.json")
        
        if not os.path.exists(model_path) or not os.path.exists(meta_path):
            raise FileNotFoundError("ETA model files not found")
            
        _model = joblib.load(model_path)
        with open(meta_path, "r") as f:
            _metadata = json.load(f)
            
    return _model, _metadata

def predict_eta(req: ETARequest) -> ETAResponse:
    model, metadata = get_eta_model()
    
    # Validation logic inside schemas handles most edge cases.
    # We can also add explicit sanity check here just in case.
    if req.distance_km < 0 or req.average_speed_kmh <= 0:
        raise ValueError("Invalid physical parameters")

    df = pd.DataFrame([{
        "distance_km": req.distance_km,
        "route_distance_km": req.route_distance_km,
        "time_of_day": req.time_of_day,
        "day_of_week": req.day_of_week,
        "traffic_factor": req.traffic_factor,
        "average_speed_kmh": req.average_speed_kmh,
        "road_complexity": req.road_complexity,
        "weather_factor": req.weather_factor,
        "ambulance_load_factor": req.ambulance_load_factor,
        "pickup_delay_minutes": req.pickup_delay_minutes
    }])
    
    # Predict ETA
    pred_eta = float(model.predict(df)[0])
    
    # Bounds logic
    pred_eta = max(1.0, pred_eta)
    
    # Calculate interval based on MAE as uncertainty representation.
    # The RandomForest doesn't naturally emit quantile intervals without 
    # being trained as QuantileRegression. We'll use RMSE/MAE from training.
    mae = metadata.get("metrics", {}).get("mae", 5.0)
    
    lower = max(1.0, pred_eta - mae)
    upper = pred_eta + mae
    
    return ETAResponse(
        predicted_eta_minutes=round(pred_eta, 1),
        model_version=metadata["model_version"],
        synthetic_model=metadata.get("synthetic", True),
        prediction_interval=ETAPredictionInterval(
            lower=round(lower, 1),
            upper=round(upper, 1)
        )
    )
