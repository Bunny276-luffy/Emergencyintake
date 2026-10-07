# ML Triage Service (Phase 2A)

This subsystem provides a REAL machine-learning foundation for the Emergency AI Platform. It is an assistive recommendation system for emergency triage severity prediction.

**IMPORTANT:** The current model is an engineering/demo prototype trained on synthetic data and is NOT clinically validated. It must NOT be used for real medical diagnosis.

## Architecture

- **`data_gen.py` & `data_gen_eta.py`**: Deterministic synthetic dataset generators with realistic overlaps.
- **`features.py`**: Reusable scikit-learn pipelines for data preprocessing (Triage and ETA).
- **`schemas.py`**: Pydantic schemas validating input/output for both `/predict/triage` and `/predict/eta`.
- **`train.py` & `train_eta.py`**: Model training, generation and evaluation.
- **`predict.py` & `predict_eta.py`**: Model inference containing deterministic safety reconciliation layers and bound calculations.
- **`main.py`**: FastAPI app providing the POST `/predict/triage` and `/predict/eta` endpoints.

## Getting Started

1. Create a virtual environment and install dependencies:
   ```bash
   uv venv
   . .venv/bin/activate  # or .venv\Scripts\activate on Windows
   uv pip install -r requirements.txt
   ```
2. Train the model (this will generate the synthetic data and model files automatically):
   ```bash
   python -m src.train
   ```
3. Run tests:
   ```bash
   python -m pytest tests/
   ```
4. Start the service:
   ```bash
   uvicorn src.main:app --reload --port 8000
   ```

## API

`POST /predict/triage`

**Request:**
```json
{
  "age": 45,
  "heart_rate": 120,
  "spo2": 89,
  "systolic_bp": 90,
  "respiratory_rate": 28,
  "temperature": 38.1,
  "gcs": 12,
  "bleeding": true,
  "breathing_difficulty": true,
  "chest_pain": false,
  "injury_severity": 3,
  "incident_type": "TRAUMA"
}
```

**Response:**
```json
{
  "severity_class": "CRITICAL",
  "confidence": 0.91,
  "model_version": "triage-v1",
  "synthetic_model": true,
  "safety_escalation": true,
  "top_factors": ["Low SpO2", "Elevated heart rate", "Reduced GCS"]
}
```
