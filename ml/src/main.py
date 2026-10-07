from fastapi import FastAPI, HTTPException
from src.schemas import TriageRequest, TriageResponse, ETARequest, ETAResponse
from src.predict import predict_triage
from src.predict_eta import predict_eta
import logging

app = FastAPI(title="Emergency AI Triage ML Service", version="1.0.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.post("/predict/triage", response_model=TriageResponse)
def triage_endpoint(req: TriageRequest):
    try:
        response = predict_triage(req)
        return response
    except FileNotFoundError as e:
        logger.error(f"Model not found: {str(e)}")
        raise HTTPException(status_code=503, detail="ML model is currently unavailable")
    except Exception as e:
        logger.error(f"Error during ML prediction: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal ML Service Error")

@app.post("/predict/eta", response_model=ETAResponse)
def eta_endpoint(req: ETARequest):
    try:
        response = predict_eta(req)
        return response
    except FileNotFoundError as e:
        logger.error(f"ETA model not found: {str(e)}")
        raise HTTPException(status_code=503, detail="ETA ML model is currently unavailable")
    except ValueError as e:
        logger.error(f"Validation Error in ETA: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error during ETA prediction: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal ML Service Error")

@app.get("/health")
def health_check():
    return {"status": "ok"}
