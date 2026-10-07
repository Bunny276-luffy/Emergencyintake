# Emergency AI Platform

**Emergency AI Platform — Release Candidate**

## PROJECT OVERVIEW

**Problem:**
Emergency response is fragmented between citizens, dispatch, ambulances, paramedics, and hospitals. Data is lost in transit, and spatial awareness is poor.

**Solution:**
Emergency AI Platform creates one realtime coordinated emergency workflow. It leverages ML for ETA and triage assistance, generative AI for structuring clinical voice reports, and spatial databases for intelligent dispatch.

**Core workflow:**
Citizen SOS → Dispatch → Ambulance → Paramedic → Hospital → Handoff

### Technology Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL + PostGIS + Prisma
- **Realtime:** Socket.IO
- **Generative AI:** Gemini (Voice-to-Clinical Structuring)
- **ML Subsystem:** Python + FastAPI + scikit-learn
- **ML Models:** `triage-v1` (Severity Recommendation), `eta-v1` (Arrival Estimation)

### Important Limitations & Prototype Status
- **Prototype Status:** This is a prototype system under development, not a production-ready medical device.
- **No Real Emergency Integration:** Does not integrate with real 108/112 services or hospital infrastructure.
- **ML Limitations:** Models (`triage-v1`, `eta-v1`) are trained on synthetic datasets. ETA does not account for real-time traffic or weather data.
- **Human Authority:** AI features are strictly for *decision support*. The final authority remains with qualified dispatchers, paramedics, and hospital staff. There is no claim of clinical validation.

---

## FRESH-START REPRODUCIBILITY

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL with **PostGIS extension installed**.

### Environment Variables
Copy the `.env.example` files to `.env` in both `backend/` and `ml/` directories and fill them with safe local values.
**Do not expose or commit secrets.**

### 1. Database Setup
Ensure PostgreSQL is running and the PostGIS extension is enabled on the database `emergency_ai`.
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### 2. ML Service Setup
```bash
cd ml
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### 3. Backend Startup
```bash
cd backend
# If not already installed: npm install
npm run dev
```

### 4. Frontend Startup
```bash
cd frontend
npm install
npm run dev
```

### Build & Test Commands
- **Backend Tests:** `cd backend && npm test`
- **ML Tests:** `cd ml && python -m pytest tests/`
- **Frontend Build:** `cd frontend && npm run build`
