# Emergency AI Platform

Emergency AI Platform is a realtime emergency-response coordination platform that connects citizens, dispatchers, ambulance drivers, paramedics, and hospitals into a single, cohesive workflow.

## Overview

Emergency response often involves disconnected workflows between citizens, dispatch teams, ambulance crews, paramedics, and hospitals. Miscommunication and delays can severely impact patient outcomes.

The Emergency AI Platform provides a connected realtime workflow where an emergency can seamlessly move from a citizen's SOS through dispatcher assignment, ambulance response, paramedic clinical assessment, hospital preparation, and final handoff.

## Core Workflow

```text
Citizen SOS
      ↓
Dispatch
      ↓
Ambulance Assignment
      ↓
Ambulance Response
      ↓
Paramedic Assessment
      ↓
Hospital Pre-arrival
      ↓
Hospital Arrival
      ↓
Handoff
      ↓
Ambulance Available
```

Realtime synchronization between all operational clients is maintained using Socket.IO, ensuring all participants have up-to-the-second visibility into the incident.

## Interfaces

The platform features six distinct operational workstations:

| Interface | Purpose |
| --- | --- |
| **Public SOS** | Allows citizens to report emergencies and share location. |
| **Dispatch Center** | Centralized dashboard for dispatchers to manage incidents and assign ambulances. |
| **Ambulance Driver** | Provides assignment details and live GPS routing integration. |
| **Paramedic Team** | Supports clinical reporting, triage assessment, and patient handover. |
| **Hospital ER** | Provides pre-arrival notifications, resource capacity management, and reservations. |
| **Admin** | System monitoring, fleet oversight, error logs, and audit trails. |

## Key Capabilities

- Public emergency SOS reporting
- GPS/location tracking and handling
- Robust incident lifecycle/state machine
- Dispatcher assignment and ambulance workflow management
- Live location support via Socket.IO
- Paramedic vitals capture and triage
- ML-assisted triage predictions
- ML-assisted ETA predictions
- Gemini-based generative clinical/operational structuring
- Hospital pre-arrival and reservation workflow
- Hospital resource and readiness capacity handling
- Realtime Socket.IO operational updates
- JWT authentication and role-based authorization (RBAC)
- Strict resource ownership enforcement
- SOS reporting idempotency
- Rate limiting and API protection
- System error and failure handling
- PostGIS spatial data and geographic queries
- Audit and operational monitoring

## AI and ML

The Emergency AI Platform features integrated machine learning models and generative AI to assist emergency personnel.

### ML Triage — `triage-v1`
An ML-based decision support system designed to predict emergency triage severity based on incoming vital signs and situational data.
- Implemented in Python via FastAPI using scikit-learn.
- Predicts severity tiers while applying deterministic safety escalation rules to prevent critical underrating.
- **Note:** This is purely an assistive recommendation system, not a medical diagnosis tool. The qualified paramedic remains entirely responsible for final triage and clinical decisions.

### ML ETA — `eta-v1`
Provides an ML-assisted Estimated Time of Arrival (ETA) for ambulance routing.
- **Note:** Real-time traffic, weather, and road complexity inputs currently rely on synthetic/default parameters where applicable. ETA predictions are estimates and are not guaranteed.

### Generative AI — Gemini
Google Gemini is integrated to assist with generative clinical and operational data structuring (e.g., structuring paramedic voice notes or unstructured incident text into formal clinical reports). Gemini is strictly compartmentalized from the deterministic ML and backend workflow systems.

## Architecture

```text
       Browser Workstations
                |
                v
          React + Vite
                |
                v
        Node.js + Express
                |
          +-----+-----+
          |           |
          v           v
    PostgreSQL    Socket.IO
     + PostGIS
          |
          v
   Python FastAPI ML
          |
          +--> triage-v1
          |
          +--> eta-v1
```
*(Google Gemini is accessed as an external generative AI service from the backend.)*

## Security

- **Authentication:** JSON Web Tokens (JWT) for secure session management.
- **Authorization:** Role-Based Access Control (RBAC) preventing cross-role access.
- **Resource Ownership:** Enforced strict ownership preventing users from modifying incidents or resources they do not own or manage.
- **Realtime Security:** Authenticated Socket.IO connections and authorized realtime event broadcasting (isolated rooms).
- **Rate Limiting:** IP-based and user-based rate limiting to prevent abuse.
- **Input Validation:** Zod schema validation across backend and ML services.
- **Public SOS:** The citizen SOS route is intentionally unauthenticated because reporting life-threatening emergencies must not be gated by account creation.
- **Idempotency:** Public SOS submission is protected by idempotency keys to prevent duplicate incident creation.

## Incident State Machine

The platform enforces a strict incident progression state machine:

`ASSIGNED` → `DISPATCHED` → `REPORTED` → `PATIENT_PICKED_UP` → `TRANSPORTING` → `ARRIVED_AT_HOSPITAL` → `HANDOFF_COMPLETED`

Backend validation ensures that incidents can only transition through valid sequences.

## Project Structure

```text
├── backend/       # Node.js/Express API, Prisma ORM, Socket.IO server
├── docs/          # Project documentation and reports
├── frontend/      # React/Vite web application and workstations
├── ml/            # Python FastAPI service, model training, and ML endpoints
└── prisma/        # Database schema and migrations
```

## Setup & Installation

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL with the PostGIS extension installed

### Clone the Repository
```bash
git clone https://github.com/Bunny276-luffy/Emergencyintake.git
cd Emergencyintake
```

### Environment Configuration
The project uses `.env` files for configuration. Do not commit actual secrets to version control.
You will need to create local `.env` files based on the provided examples:
- Copy `backend/.env.example` to `backend/.env`
- Copy `frontend/.env.example` to `frontend/.env`
- Copy `ml/.env.example` to `ml/.env`

**Key Variables:**
- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `ML_SERVICE_URL`
- `PORT` and `CORS_ORIGIN`

### Installation

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

**Machine Learning Service:**
```bash
cd ml
python -m venv .venv
# On Windows: .\.venv\Scripts\activate
# On Unix: source .venv/bin/activate
pip install -r requirements.txt
```

### Database Setup
From the `backend/` directory, run the database migrations and generate the Prisma client:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Running the Platform
To run the full stack locally, open three separate terminal windows:

**1. Start the ML Service:**
```bash
cd ml
# Ensure virtual environment is active
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

**2. Start the Backend:**
```bash
cd backend
npm run dev
```

**3. Start the Frontend:**
```bash
cd frontend
npm run dev
```

## Testing

The platform maintains comprehensive test suites:

**Backend Tests (102/102 passing):**
```bash
cd backend
npm run type-check
npm test
```

**ML Tests (6/6 passing):**
```bash
cd ml
python -m pytest
```

**Frontend Validation:**
```bash
cd frontend
npm run type-check
npm run build
```

## Limitations

- ML training and evaluation currently rely on synthetic datasets.
- ETA predictions (traffic, weather, and road complexity inputs) currently use synthetic/default parameters where applicable.
- ETA predictions are estimates and are **not guaranteed**.
- **No clinical diagnosis** is provided by the system.
- All AI and ML outputs serve purely as decision-support or generative assistance. Final clinical decisions must remain with qualified medical personnel.
- There is currently no direct integration with real-world emergency service infrastructure (e.g., live 911 dispatch APIs).
- The models and workflow make no claim of formal clinical validation.

## Roadmap (Future Work)

- Live traffic and weather API integrations for accurate ETAs.
- Production mapping and turn-by-turn routing integrations.
- API bridges to real-world emergency service infrastructure.
- Improved ML models trained on real-world, anonymized clinical datasets.
- Advanced model monitoring and drift detection.
- Multilingual emergency communication for public SOS.
- Scaled production deployment architecture.
- Advanced automated hospital bed/capacity integration.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/MyFeature`).
3. Make your changes and ensure all tests pass.
4. Open a pull request.

## Acknowledgments & Technologies
Built with React, Vite, TypeScript, Node.js, Express, PostgreSQL, PostGIS, Prisma, Socket.IO, Python, FastAPI, scikit-learn, and Google Gemini.
