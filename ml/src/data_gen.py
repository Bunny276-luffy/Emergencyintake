import pandas as pd
import numpy as np
import os

def generate_synthetic_data(num_samples=2000, seed=42):
    np.random.seed(seed)
    
    # Generate features
    age = np.random.randint(0, 100, num_samples)
    
    # Heart rate: normal ~60-100. Higher or lower indicates issues.
    heart_rate = np.random.normal(85, 20, num_samples).astype(int)
    
    # SpO2: normal > 95.
    spo2 = np.clip(np.random.normal(95, 5, num_samples), 50, 100).astype(int)
    
    # Systolic BP: normal ~120
    systolic_bp = np.random.normal(120, 25, num_samples).astype(int)
    
    # Respiratory rate: normal 12-20
    respiratory_rate = np.random.normal(18, 6, num_samples).astype(int)
    
    # Temperature: normal 36.5-37.5
    temperature = np.clip(np.random.normal(37.0, 1.0, num_samples), 30.0, 42.0)
    
    # GCS: normal 15
    gcs = np.random.choice([15, 14, 13, 12, 10, 8, 6, 3], num_samples, p=[0.6, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05])
    
    bleeding = np.random.choice([True, False], num_samples, p=[0.2, 0.8])
    breathing_difficulty = np.random.choice([True, False], num_samples, p=[0.3, 0.7])
    chest_pain = np.random.choice([True, False], num_samples, p=[0.2, 0.8])
    
    injury_severity = np.random.randint(1, 6, num_samples)
    
    incident_type = np.random.choice(["TRAUMA", "MEDICAL", "ACCIDENT", "CARDIAC", "NEUROLOGICAL"], num_samples)
    
    # Rule-based severity logic (with some random noise)
    severity_scores = np.zeros(num_samples)
    
    # High risk factors
    severity_scores += np.where(spo2 < 90, 3, 0)
    severity_scores += np.where(spo2 < 85, 5, 0)
    severity_scores += np.where(gcs < 13, 3, 0)
    severity_scores += np.where(gcs < 9, 6, 0)
    severity_scores += np.where(systolic_bp < 90, 4, 0)
    severity_scores += np.where(systolic_bp > 180, 3, 0)
    severity_scores += np.where(heart_rate > 130, 2, 0)
    severity_scores += np.where(heart_rate < 50, 2, 0)
    severity_scores += np.where(bleeding, 2, 0)
    severity_scores += np.where(breathing_difficulty, 2, 0)
    severity_scores += np.where(chest_pain, 2, 0)
    severity_scores += (injury_severity - 1)
    
    # Add random noise to simulate real-world overlap
    severity_scores += np.random.normal(0, 1.5, num_samples)
    
    # Map scores to classes
    severity_class = []
    for score in severity_scores:
        if score < 3:
            severity_class.append("LOW")
        elif score < 6:
            severity_class.append("MODERATE")
        elif score < 10:
            severity_class.append("HIGH")
        else:
            severity_class.append("CRITICAL")
            
    df = pd.DataFrame({
        "age": age,
        "heart_rate": heart_rate,
        "spo2": spo2,
        "systolic_bp": systolic_bp,
        "respiratory_rate": respiratory_rate,
        "temperature": temperature,
        "gcs": gcs,
        "bleeding": bleeding,
        "breathing_difficulty": breathing_difficulty,
        "chest_pain": chest_pain,
        "injury_severity": injury_severity,
        "incident_type": incident_type,
        "severity_class": severity_class
    })
    
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "data"), exist_ok=True)
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_triage_dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated synthetic dataset with {num_samples} samples at {out_path}")

if __name__ == "__main__":
    generate_synthetic_data()
