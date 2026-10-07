import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EmergencyIncident, ParamedicReport, Patient, TriageLevel } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { Activity, Stethoscope, Mic, Cpu, Send, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Layers } from 'lucide-react';

export const ParamedicTeamApp: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramIncidentId = searchParams.get('incidentId');

  const [incidentId, setIncidentId] = useState(paramIncidentId || '');
  const [incident, setIncident] = useState<EmergencyIncident | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [report, setReport] = useState<ParamedicReport | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<EmergencyIncident[]>([]);

  // Form State
  const [conditionSummary, setConditionSummary] = useState('');
  const [triageLevel, setTriageLevel] = useState<TriageLevel>('IMMEDIATE_RED');
  const [heartRate, setHeartRate] = useState('95');
  const [bpSystolic, setBpSystolic] = useState('120');
  const [bpDiastolic, setBpDiastolic] = useState('80');
  const [spo2, setSpo2] = useState('98');
  const [gcs, setGcs] = useState('15');
  const [audioUrl, setAudioUrl] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const speechRecognitionRef = React.useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync URL search params
  useEffect(() => {
    const param = searchParams.get('incidentId');
    if (param && param !== incidentId) {
      setIncidentId(param);
    }
  }, [searchParams, incidentId]);

  const fetchIncidentClinicalData = React.useCallback(async (targetId?: string) => {
    const idToFetch = targetId || incidentId;
    if (!idToFetch) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAssignedParamedicIncident(idToFetch);
      setIncident(data.incident);
      const resolvedPatient = data.patient || (data as any).patients?.[0] || null;
      setPatient(resolvedPatient);

      if (data.report) {
        setReport(data.report);
        setConditionSummary(data.report.patientConditionSummary);
        setTriageLevel(data.report.triageLevel);
        if (data.report.vitals) {
          if (data.report.vitals.heartRate) setHeartRate(String(data.report.vitals.heartRate));
          if (data.report.vitals.bloodPressureSystolic) setBpSystolic(String(data.report.vitals.bloodPressureSystolic));
          if (data.report.vitals.bloodPressureDiastolic) setBpDiastolic(String(data.report.vitals.bloodPressureDiastolic));
          if (data.report.vitals.oxygenSaturation) setSpo2(String(data.report.vitals.oxygenSaturation));
          if (data.report.vitals.glasgowComaScale) setGcs(String(data.report.vitals.glasgowComaScale));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  // Discover active operational incidents on initial mount or refresh
  const discoverActiveIncident = React.useCallback(async () => {
    try {
      const activeList = await api.listActiveIncidents();
      setActiveIncidents(activeList);

      // If no incident is currently selected/specified in URL, auto-load the most recent active emergency
      if (!paramIncidentId && !incidentId && activeList.length > 0) {
        const topActive = activeList[0];
        setIncidentId(topActive.id);
        setSearchParams({ incidentId: topActive.id });
        await fetchIncidentClinicalData(topActive.id);
      }
    } catch (err: any) {
      console.warn('[PARAMEDIC_DISCOVERY] Could not auto-discover active incident:', err.message);
    }
  }, [paramIncidentId, incidentId, setSearchParams, fetchIncidentClinicalData]);

  useEffect(() => {
    discoverActiveIncident();
  }, [discoverActiveIncident]);

  useEffect(() => {
    if (incidentId) {
      fetchIncidentClinicalData(incidentId);
      socketService.joinParamedicRoom(incidentId);
    }

    const handleIncidentCreated = (newInc: EmergencyIncident) => {
      setActiveIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
      setIncidentId((prev) => {
        if (!prev) {
          fetchIncidentClinicalData(newInc.id);
          return newInc.id;
        }
        return prev;
      });
    };

    const handleAutoDispatched = (data: any) => {
      if (data?.incidentId) {
        setIncidentId((prev) => {
          if (!prev) {
            fetchIncidentClinicalData(data.incidentId);
            return data.incidentId;
          }
          return prev;
        });
      }
      discoverActiveIncident();
    };

    const handleAmbulanceAssigned = (data: { incidentId: string }) => {
      if (data?.incidentId) {
        setIncidentId((prev) => {
          if (!prev) {
            fetchIncidentClinicalData(data.incidentId);
            return data.incidentId;
          }
          return prev;
        });
      }
      discoverActiveIncident();
    };

    const handleStatusUpdated = (data: any) => {
      if (data?.incidentId && data.incidentId === incidentId) {
        fetchIncidentClinicalData(incidentId);
      }
    };

    const handleHandoffCompleted = (data: { incidentId: string }) => {
      if (data?.incidentId === incidentId) {
        setIncident((prev) => (prev ? { ...prev, status: 'HANDOFF_COMPLETED' } : null));
      }
      discoverActiveIncident();
    };

    socketService.on('INCIDENT_CREATED', handleIncidentCreated);
    socketService.on('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);
    socketService.on('AMBULANCE_ASSIGNED', handleAmbulanceAssigned);
    socketService.on('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
    socketService.on('HANDOFF_COMPLETED', handleHandoffCompleted);

    return () => {
      if (incidentId) socketService.leaveRoom(`paramedic-room:${incidentId}`);
      socketService.off('INCIDENT_CREATED', handleIncidentCreated);
      socketService.off('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);
      socketService.off('AMBULANCE_ASSIGNED', handleAmbulanceAssigned);
      socketService.off('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
      socketService.off('HANDOFF_COMPLETED', handleHandoffCompleted);
    };
  }, [incidentId, fetchIncidentClinicalData, discoverActiveIncident]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);

        // Speech Recognition API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          speechRecognitionRef.current = new SpeechRecognition();
          speechRecognitionRef.current.continuous = true;
          speechRecognitionRef.current.interimResults = true;
          
          let finalTranscript = conditionSummary;
          
          speechRecognitionRef.current.onresult = (event: any) => {
            let interimTranscript = '';
            let newFinal = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                newFinal += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }
            if (newFinal) {
              finalTranscript += (finalTranscript ? ' ' : '') + newFinal;
              setConditionSummary(finalTranscript);
            } else if (interimTranscript) {
              setConditionSummary(finalTranscript + (finalTranscript ? ' ' : '') + interimTranscript);
            }
          };
          
          speechRecognitionRef.current.start();
        }
      } catch (err: any) {
        setError('Microphone access denied or not available.');
      }
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentId) {
      setError('Please enter a valid Incident ID');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      const createdReport = await api.submitClinicalReport({
        incidentId,
        patientConditionSummary: conditionSummary,
        triageLevel,
        vitals: {
          heartRate: parseInt(heartRate, 10),
          bloodPressureSystolic: parseInt(bpSystolic, 10),
          bloodPressureDiastolic: parseInt(bpDiastolic, 10),
          oxygenSaturation: parseInt(spo2, 10),
          glasgowComaScale: parseInt(gcs, 10),
          recordedAt: new Date().toISOString(),
        },
        voiceReportAudioUrl: audioUrl,
      });

      setReport(createdReport);
      setSuccessMsg('Clinical report and patient vitals transmitted to Emergency AI Core and Destination ER');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAIStructuring = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.structureVoiceReportAI(audioUrl, conditionSummary);
      setAiResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="app-view" style={{ padding: '1.5rem 1rem' }}>
      <div className="app-title-bar">
        <div className="app-title-info">
          <h1>
            <Stethoscope style={{ color: 'var(--accent-purple)' }} size={28} /> Paramedic Team Workspace
          </h1>
          <p>On-scene clinical assessment, vitals telemetry & voice report AI structuring</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeIncidents.length > 0 && (
            <select
              value={incidentId}
              onChange={(e) => {
                const newId = e.target.value;
                setIncidentId(newId);
                setSearchParams({ incidentId: newId });
                if (newId) fetchIncidentClinicalData(newId);
              }}
              style={{ fontWeight: '700', padding: '0.45rem 0.75rem', maxWidth: '240px' }}
            >
              <option value="">-- Active Cases ({activeIncidents.length}) --</option>
              {activeIncidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.id}: {inc.emergencyType} ({inc.status})
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="Incident ID (e.g. INC-101)"
            style={{ width: '180px', fontWeight: '700' }}
          />
          <button className="btn btn-primary" onClick={() => fetchIncidentClinicalData(incidentId)} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : 'Load Incident'}
          </button>
          <button className="btn btn-secondary" onClick={discoverActiveIncident} disabled={loading} title="Refresh active cases">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
            <AlertTriangle size={22} />
            <div><strong>Clinical Error:</strong> {error}</div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="card" style={{ backgroundColor: 'var(--accent-green-bg)', borderColor: 'var(--accent-green)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-green)' }}>
            <CheckCircle2 size={22} />
            <div>{successMsg}</div>
          </div>
        </div>
      )}

      {!incident ? (
        <div className="empty-state" style={{ padding: '4rem 1.5rem' }}>
          <Stethoscope className="empty-state-icon" color="var(--text-muted)" />
          <div className="empty-state-title">No Incident Record Loaded</div>
          <div className="empty-state-desc">Waiting for an active emergency dispatch or select an active incident ID above to inspect patient medical data and transmit clinical reports</div>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: '1.5rem' }}>
          {/* Incident & Patient Profile Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <div className="card-title">
                <span>Assigned Emergency Scene</span>
                <span className="badge badge-blue">ID: {incident.id}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', lineHeight: '1.5' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Type:</strong> <span style={{ marginLeft: '0.35rem' }}>{incident.emergencyType}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Priority:</strong> <span className="badge badge-red" style={{ marginLeft: '0.35rem' }}>{incident.priority}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> <span className="badge badge-blue" style={{ marginLeft: '0.35rem' }}>{incident.status}</span></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Description:</strong> <span style={{ marginLeft: '0.35rem' }}>{incident.description}</span></div>
                {incident.assignedAmbulanceId && (
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Assigned Ambulance:</strong> <span style={{ marginLeft: '0.35rem', fontWeight: '700', color: 'var(--accent-blue)' }}>{incident.assignedAmbulanceId}</span></div>
                )}
                {incident.destinationHospitalId && (
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Destination Hospital:</strong> <span style={{ marginLeft: '0.35rem', fontWeight: '700', color: 'var(--accent-green)' }}>{incident.destinationHospitalId}</span></div>
                )}
              </div>
            </div>

            {incident.mlTriagePrediction && (
              <div className="card" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                <div className="card-title" style={{ color: 'var(--accent-red)' }}>
                  <Activity size={20} /> ML Triage Severity Prediction
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', lineHeight: '1.5', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Recommended Triage:</strong>
                    <span className="badge badge-red">{incident.mlTriagePrediction.severityRecommendation}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Confidence:</strong>
                    <span style={{ fontWeight: '600' }}>{(incident.mlTriagePrediction.confidence * 100).toFixed(1)}%</span>
                  </div>
                  {incident.mlTriagePrediction.safetyEscalation && (
                    <div style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', marginTop: '0.5rem' }}>
                      <AlertTriangle size={16} /> SAFETY ESCALATION TRIGGERED
                    </div>
                  )}
                  {incident.mlTriagePrediction.topFactors && incident.mlTriagePrediction.topFactors.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Key Clinical Factors:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, fontSize: '0.85rem' }}>
                        {incident.mlTriagePrediction.topFactors.map((factor: string, i: number) => (
                          <li key={i}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span>Model Version: {incident.mlTriagePrediction.modelVersion || 'v1'}</span>
                    {incident.mlTriagePrediction.generatedAt && <span>Generated: {new Date(incident.mlTriagePrediction.generatedAt).toLocaleString()}</span>}
                    <strong style={{ color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Decision support only. Final triage remains with the qualified paramedic.</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Patient Medical Profile</div>
              {patient ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', lineHeight: '1.5' }}>
                  <div><strong>Name:</strong> {patient.name || 'Anonymous'}</div>
                  <div><strong>Age / Gender:</strong> {patient.age || 'N/A'} yrs / {patient.gender || 'N/A'}</div>
                  <div><strong>Blood Type:</strong> <span className="badge badge-amber" style={{ marginLeft: '0.35rem' }}>{patient.bloodType || 'Unknown'}</span></div>
                  <div><strong>Known Conditions:</strong> {patient.knownMedicalConditions && patient.knownMedicalConditions.length > 0 ? patient.knownMedicalConditions.join(', ') : 'None recorded'}</div>
                  <div><strong>Allergies:</strong> {patient.allergies && patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None recorded'}</div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pre-existing patient profile linked to this emergency</div>
              )}
            </div>

            {/* Gemini AI Clinical Assistant */}
            <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
              <div className="card-title" style={{ color: 'var(--accent-purple)' }}>
                <Cpu size={20} /> Gemini AI Voice Clinical Gateway
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
                Automated clinical report structuring from paramedic observations & voice telemetry.
              </p>

              <button className="btn btn-secondary" onClick={handleAIStructuring} disabled={aiLoading} style={{ width: '100%', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', fontWeight: '700' }}>
                {aiLoading ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                {aiLoading ? 'ANALYZING VOICE CLINICAL TELEMETRY...' : 'RUN GEMINI CLINICAL STRUCTURING'}
              </button>

              {aiResult && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '700', color: aiResult.status === 'SUCCESS' ? 'var(--accent-purple)' : 'var(--accent-red)' }}>
                    AI Status: {aiResult.status} ({aiResult.message})
                  </div>
                  {aiResult.status !== 'SUCCESS' && (
                    <div style={{ marginTop: '0.75rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={16} />
                      <strong>AI assistance unavailable. Continue with manual clinical assessment.</strong>
                    </div>
                  )}
                  {aiResult.structuredReport && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Primary Condition:</strong> <span style={{ fontWeight: '600' }}>{aiResult.structuredReport.primaryCondition}</span></div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Suggested Triage:</strong> <span className="badge badge-red">{aiResult.structuredReport.triageLevelSuggestion}</span></div>
                      <div><strong style={{ color: 'var(--text-secondary)' }}>Summary:</strong> {aiResult.structuredReport.summary}</div>
                      
                      {aiResult.structuredReport.recommendedSpecialties && aiResult.structuredReport.recommendedSpecialties.length > 0 && (
                        <div><strong style={{ color: 'var(--text-secondary)' }}>Recommended Specialties:</strong> {aiResult.structuredReport.recommendedSpecialties.join(', ')}</div>
                      )}
                      
                      {aiResult.structuredReport.preArrivalPrepInstructions && aiResult.structuredReport.preArrivalPrepInstructions.length > 0 && (
                        <div>
                          <strong style={{ color: 'var(--text-secondary)' }}>Pre-Arrival Prep:</strong>
                          <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                            {aiResult.structuredReport.preArrivalPrepInstructions.map((instruction: string, i: number) => (
                              <li key={i}>{instruction}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clinical Assessment Submission Form */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '1.25rem' }}>Submit Clinical Assessment</div>
            <form onSubmit={handleSubmitReport}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Triage Priority Level</label>
                <select value={triageLevel} onChange={(e) => setTriageLevel(e.target.value as TriageLevel)} style={{ fontWeight: '700' }}>
                  <option value="IMMEDIATE_RED">🟥 RED - Immediate Life Threat</option>
                  <option value="URGENT_YELLOW">🟨 YELLOW - Urgent Care Required</option>
                  <option value="DELAYED_GREEN">🟩 GREEN - Delayed Non-Urgent</option>
                  <option value="EXPECTANT_BLACK">⬛ BLACK - Expectant / Deceased</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Clinical Condition Assessment Summary</label>
                <textarea
                  rows={3}
                  value={conditionSummary}
                  onChange={(e) => setConditionSummary(e.target.value)}
                  placeholder="Describe patient observations, trauma severity, symptoms..."
                  required
                />
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.75rem 0' }}>
                Vital Signs Telemetry
              </div>
              <div className="grid-2" style={{ gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Heart Rate (BPM)</label>
                  <input type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">SpO2 (%)</label>
                  <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">BP Systolic</label>
                  <input type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">BP Diastolic</label>
                  <input type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                  <label className="form-label">Glasgow Coma Scale (GCS)</label>
                  <input type="number" value={gcs} onChange={(e) => setGcs(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Voice Report Audio URL</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleRecording}>
                    <Mic size={16} /> {isRecording ? 'Stop Recording' : 'Record'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', fontWeight: '700' }}>
                <Send size={18} /> Transmit Clinical Report
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
