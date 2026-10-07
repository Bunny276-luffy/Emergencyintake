import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, median_absolute_error
import json
from src.features import get_eta_preprocessor

def train_eta_model():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_eta_dataset.csv")
    if not os.path.exists(data_path):
        from src.data_gen_eta import generate_synthetic_eta_data
        generate_synthetic_eta_data()
        
    df = pd.read_csv(data_path)
    
    X = df.drop(columns=["eta_minutes"])
    y = df["eta_minutes"]
    
    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    preprocessor, num_features, cat_features = get_eta_preprocessor()
    
    # Baseline
    baseline = Pipeline([
        ('preprocessor', preprocessor),
        ('reg', LinearRegression())
    ])
    baseline.fit(X_train, y_train)
    y_pred_base = baseline.predict(X_test)
    
    # Final Model
    reg = Pipeline([
        ('preprocessor', preprocessor),
        ('reg', RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    reg.fit(X_train, y_train)
    y_pred = reg.predict(X_test)
    
    # Evaluation
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    medae = median_absolute_error(y_test, y_pred)
    
    metrics = {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2": float(r2),
        "median_absolute_error": float(medae)
    }
    
    print("Metrics:", metrics)
    
    # Save model
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    model_version = "eta-v1"
    model_path = os.path.join(models_dir, f"{model_version}.joblib")
    joblib.dump(reg, model_path)
    
    # Save metadata
    metadata = {
        "model_version": model_version,
        "algorithm": "RandomForestRegressor",
        "dataset": "synthetic_eta_dataset",
        "synthetic": True,
        "metrics": metrics,
        "features": list(X.columns),
        "random_seed": 42,
        "trained_at": datetime.utcnow().isoformat()
    }
    
    with open(os.path.join(models_dir, "eta_metrics.json"), "w") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_eta_model()
