# Emergency AI Platform - Demo Script
*(Duration: 7-10 minutes)*

## 0:00–0:45 | Problem Statement
"Emergency response today suffers from fragmented communication. When a citizen calls an ambulance, the dispatch center uses one system, the driver another, the paramedic takes notes on paper, and the hospital is blindsided upon arrival. We built the Emergency AI Platform to create one real-time, coordinated, AI-assisted workflow from SOS to Hospital Handoff."

## 0:45–1:30 | Architecture Overview
"Our platform spans six synchronized React workstations, backed by a Node.js API with a PostgreSQL/PostGIS database for spatial intelligence. We use strictly authenticated Socket.IO connections for sub-second telemetry, and a Python FastAPI subsystem running Scikit-Learn models to provide ETA and Triage decision support."

## 1:30–2:30 | Citizen SOS
*(Action: Open `/sos` on a mobile-sized browser window without logging in.)*
"It begins with a public, mobile-friendly SOS portal. The citizen provides their location and a brief description of the emergency. This requires no login to remove friction during a crisis."
*(Action: Submit the SOS. Note the success UI.)*

## 2:30–3:30 | Dispatch + Spatial/ETA Intelligence
*(Action: Open a new tab, go to `/login`, login as `DISP-001`. Navigate to `/dispatch`.)*
"Instantly, the Dispatch Center receives the incident via WebSocket. The system utilizes PostGIS to calculate the closest available ambulance and hospital beds. It also queries our ML subsystem (`eta-v1`) to provide an advisory 'ML-assisted ETA estimate' based on historical data. If the dispatcher agrees, they approve the automated assignment."
*(Action: Assign the ambulance.)*

## 3:30–4:30 | Ambulance Realtime Workflow
*(Action: Open a new tab, login as `AMB-001`. Navigate to `/ambulance`.)*
"The assigned ambulance driver receives the notification. Their console is touch-optimized for navigation. They acknowledge the assignment. If the driver enables GPS, their live coordinates transmit back to dispatch. As they reach the scene, they tap 'Arrived at Scene'."
*(Action: Click through the workflow up to Arrived at Scene.)*

## 4:30–5:45 | Paramedic + ML Triage + Gemini
*(Action: Open a new tab, login as `PARA-001`. Navigate to `/paramedic`.)*
"At the scene, the Paramedic takes over. They record vitals. Our second ML model (`triage-v1`) evaluates the vitals against synthetic clinical baselines, providing a Severity Recommendation and highlighting safety escalations. 
Crucially, this is *decision support only*. We also utilize Google's Gemini AI to parse the paramedic's voice summary into a structured clinical report. This prevents lost context in noisy environments."
*(Action: Run the AI Structuring and submit the clinical report.)*

## 5:45–6:45 | Hospital Pre-arrival Readiness
*(Action: Open a new tab, login as `HOSP-001`. Navigate to `/hospital`.)*
"Simultaneously, the receiving hospital sees the incoming ambulance. Rather than a chaotic radio call, the ER staff sees the structured Gemini report and ML Triage prediction on their dashboard *before* the patient arrives, allowing them to prep the right specialists and trauma bays."
*(Action: Acknowledge the incoming emergency.)*

## 6:45–7:30 | Handoff + Resource Recovery
*(Action: Switch back to the Ambulance tab. Click 'Arrive at Hospital' and 'Complete Handoff'.)*
"The ambulance arrives. The physical handoff happens, and the driver clicks 'Complete Handoff'."
*(Action: Switch back to Dispatch tab.)*
"The incident resolves. The ambulance unit is automatically returned to the 'AVAILABLE' pool in the Dispatch console, ready for the next crisis."

## 7:30–8:30 | Security & Resilience
"Security is paramount. You saw us log in with specific roles. If an Ambulance Driver tries to access the Dispatch console or impersonate another vehicle, the backend forcefully rejects them (403 Forbidden). 
Furthermore, resilience: If the ML server goes down, the emergency workflow doesn't break; the UI simply falls back to manual triage. We never hallucinate or fabricate clinical data."

## 8:30–10:00 | Impact + Future Scalability
"This prototype demonstrates the profound impact of a unified data pipeline. For future scalability across India, this architecture natively supports horizontal scaling of the Node servers, read-replicas for the PostGIS database, and integrating live traffic APIs (like Google Maps) into the ETA models to replace our current synthetic baselines. 
Thank you."
