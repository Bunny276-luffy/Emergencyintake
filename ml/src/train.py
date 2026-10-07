import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import json
from src.features import get_preprocessor

def train_model():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_triage_dataset.csv")
    if not os.path.exists(data_path):
        from src.data_gen import generate_synthetic_data
        generate_synthetic_data()
        
    df = pd.read_csv(data_path)
    
    X = df.drop(columns=["severity_class"])
    y = df["severity_class"]
    
    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    
    preprocessor, num_features, cat_features, bool_features = get_preprocessor()
    
    # Baseline
    baseline = Pipeline([
        ('preprocessor', preprocessor),
        ('clf', LogisticRegression(max_iter=1000, random_state=42))
    ])
    baseline.fit(X_train, y_train)
    
    # Final Model
    clf = Pipeline([
        ('preprocessor', preprocessor),
        ('clf', RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced'))
    ])
    clf.fit(X_train, y_train)
    
    # Evaluation
    from src.evaluate import evaluate_model
    metrics = evaluate_model(clf, X_test, y_test)
    
    print("Metrics:", metrics)
    
    # Save model
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    model_version = "triage-v1"
    model_path = os.path.join(models_dir, f"{model_version}.joblib")
    joblib.dump(clf, model_path)
    
    # Save metadata
    metadata = {
        "model_version": model_version,
        "algorithm": "RandomForestClassifier",
        "dataset": "synthetic_triage_dataset",
        "synthetic": True,
        "metrics": metrics,
        "features": list(X.columns),
        "random_seed": 42,
        "trained_at": datetime.utcnow().isoformat()
    }
    
    with open(os.path.join(models_dir, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model()
