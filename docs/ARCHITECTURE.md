# Emergency AI Platform - Architecture

## 1. System Overview
The Emergency AI Platform is a real-time, distributed workflow system connecting citizens in distress with a centralized dispatch, field ambulances, on-scene paramedics, and receiving hospitals.

```text
Citizen (SOS) --> Dispatch Center (Node.js/Socket.io) --> Ambulance Driver
                                                            |
                                                            v
                                                       Paramedic Team
                                                            |
                                                            v
                                                     Receiving Hospital
```

## 2. Six Workstation Architecture
- **/sos**: Public-facing lightweight reporting tool for citizens.
- **/login**: Centralized JWT authentication portal.
- **/dispatch**: Command center for incident monitoring, ML-assisted ETA, and assignment.
- **/ambulance**: GPS telemetry and status workflow console for drivers.
- **/paramedic**: Clinical assessment, vitals telemetry, and Gemini AI structuring.
- **/hospital**: Receiving emergency room view for bed reservations and handoff.

## 3. Backend Services
- **Framework**: Express.js + Node.js
- **Pattern**: Controller-Service-Repository architecture.
- **Key Modules**: `AuthService`, `DispatchService`, `AmbulanceService`, `HospitalService`, `MLService`, `AIService` (Gemini).

## 4. Database Architecture
- **ORM**: Prisma
- **Store**: PostgreSQL
- **Key Tables**: `EmergencyIncident`, `Ambulance`, `Hospital`, `User`, `ParamedicReport`

## 5. PostGIS Spatial Intelligence
- PostgreSQL is augmented with PostGIS for spatial geometries (Point) to quickly calculate distance, bounding boxes, and nearest-neighbor for ambulances and hospitals based on the incident coordinates.

## 6. Socket.IO Realtime Architecture
- Real-time event broadcasting utilizing Namespaces and authenticated Rooms.
- Events (`AMBULANCE_STATUS_UPDATED`, `INCIDENT_CREATED`) are emitted safely only to authorized room members (`dispatch-room`, `ambulance-room:<id>`, etc.).

## 7. Authentication / RBAC
- JSON Web Tokens (JWT) manage session identity.
- Backend authoritatively verifies `role` (e.g., `DISPATCHER`, `AMBULANCE_DRIVER`) before serving REST endpoints or upgrading WebSocket connections. 

## 8. ML Subsystem
- **Framework**: FastAPI (Python)
- **Models**: Scikit-Learn `RandomForestClassifier` (Triage) and `RandomForestRegressor` (ETA).
- **Function**: Exposes REST endpoints (`/predict/eta`, `/predict/triage`) consumed by the Node.js backend. Features are built on synthetic training sets.

## 9. Gemini Subsystem
- Voice clinical observations are transcribed and passed to the Gemini API (`gemini-1.5-pro`) alongside vitals.
- Output is strictly bounded by Zod schema validation to guarantee structured JSON (e.g., `primaryCondition`, `preArrivalPrepInstructions`) to prevent hallucinations and unparseable data.

## 10. Incident State Machine
`REPORTED` -> `ASSIGNED` -> `DISPATCHED` -> `PATIENT_PICKED_UP` -> `TRANSPORTING` -> `ARRIVED_AT_HOSPITAL` -> `HANDOFF_COMPLETED`.

## 11. Error Resilience
- The backend relies on idempotency keys to prevent duplicate SOS. 
- If ML or Gemini API fails, the backend catches the error and degrades gracefully without blocking the core dispatch or clinical manual workflow.

## 12. Auditability
- Timeline events log state transitions directly on the `EmergencyIncident` record (e.g., `updatedAt` tracking).
- Paramedic reports are immutable upon submission.

## 13. Security Boundaries
- Public APIs (`/api/public`) are heavily rate-limited.
- Authenticated APIs verify JWT and ensure resource ownership (e.g., Ambulance A cannot modify Ambulance B's state).
- Configured Helmet and CORS headers.
