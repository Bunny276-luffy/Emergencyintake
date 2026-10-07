import os
import joblib
import pandas as pd
from src.schemas import TriageRequest, TriageResponse

def load_model(version="triage-v1"):
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    model_path = os.path.join(models_dir, f"{version}.joblib")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model version {version} not found at {model_path}")
    return joblib.load(model_path)

def evaluate_safety_rules(req: TriageRequest) -> bool:
    """
    Deterministic safety escalation.
    Returns True if a critical safety condition is met.
    """
    if req.spo2 < 90:
        return True
    if req.gcs < 13:
        return True
    if req.systolic_bp < 90:
        return True
    if req.bleeding:
        return True
    return False

def get_top_factors(req: TriageRequest, model, df) -> list[str]:
    """
    Dummy feature importance for now. 
    In reality, we'd use SHAP or feature importances from the tree.
    """
    factors = []
    if req.spo2 < 95:
        factors.append("Low SpO2")
    if req.heart_rate > 100:
        factors.append("Elevated heart rate")
    if req.gcs < 15:
        factors.append("Reduced GCS")
    if req.systolic_bp < 90 or req.systolic_bp > 140:
        factors.append("Abnormal Systolic BP")
    if req.bleeding:
        factors.append("Active bleeding")
    
    # Take top 3
    return factors[:3] if factors else ["General clinical presentation"]

def predict_triage(req: TriageRequest, model_version="triage-v1") -> TriageResponse:
    model = load_model(model_version)
    
    # 1. Evaluate deterministic safety rules
    safety_escalation = evaluate_safety_rules(req)
    
    # 2. Prepare data for model
    df = pd.DataFrame([req.model_dump()])
    
    # 3. Model prediction
    proba = model.predict_proba(df)[0]
    classes = model.classes_
    
    prediction_idx = proba.argmax()
    predicted_class = classes[prediction_idx]
    confidence = float(proba[prediction_idx])
    
    # 4. Safety reconciliation
    if safety_escalation:
        # ML model cannot downgrade a deterministic critical safety condition.
        if predicted_class in ["LOW", "MODERATE"]:
            predicted_class = "HIGH"
            # It could also be CRITICAL depending on the exact escalation rules, 
            # but HIGH ensures it's not downgraded to low/mod.
            
    # 5. Top factors
    top_factors = get_top_factors(req, model, df)
    
    return TriageResponse(
        severity_class=predicted_class,
        confidence=confidence,
        model_version=model_version,
        synthetic_model=True,
        safety_escalation=safety_escalation,
        top_factors=top_factors
    )
