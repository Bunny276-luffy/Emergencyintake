import React, { useEffect, useState } from 'react';
import type { Hospital, BedReservation } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { LeafletMap } from '../components/LeafletMap';
import type { MapMarkerItem } from '../components/LeafletMap';
import { Building2, Bed, Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, MapPin, HeartPulse, Wind, Cpu, Loader2 } from 'lucide-react';
import { useAuth } from '../App';

export const HospitalERApp: React.FC = () => {
  const { user } = useAuth();
  const hospitalId = user?.hospitalId;

  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [reservations, setReservations] = useState<BedReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingResvId, setRejectingResvId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [expandedResvId, setExpandedResvId] = useState<string | null>(null);
  const [reportsData, setReportsData] = useState<Record<string, any>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});

  const [aiSummaryData, setAiSummaryData] = useState<Record<string, any>>({});
  const [aiSummaryLoading, setAiSummaryLoading] = useState<Record<string, boolean>>({});

  const fetchHospitalData = async () => {
    if (!hospitalId) return;
    setLoading(true);
    setError(null);
    try {
      const hProfile = await api.getHospitalProfile(hospitalId);
      const resvList = await api.getHospitalReservations(hospitalId);
      setHospital(hProfile);
      setReservations(resvList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitalData();

    socketService.joinHospitalRoom(hospitalId);

    const handleResvRequested = () => fetchHospitalData();
    const handleReportSubmitted = () => fetchHospitalData();
    const handleStatusUpdated = () => fetchHospitalData();
    const handleCapacityChanged = () => fetchHospitalData();

    socketService.on('RESERVATION_REQUESTED', handleResvRequested);
    socketService.on('CLINICAL_REPORT_SUBMITTED', handleReportSubmitted);
    socketService.on('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
    socketService.on('HOSPITAL_CAPACITY_CHANGED', handleCapacityChanged);

    return () => {
      socketService.off('RESERVATION_REQUESTED', handleResvRequested);
      socketService.off('CLINICAL_REPORT_SUBMITTED', handleReportSubmitted);
      socketService.off('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
      socketService.off('HOSPITAL_CAPACITY_CHANGED', handleCapacityChanged);
      socketService.leaveRoom(`hospital-room:${hospitalId}`);
    };
  }, [hospitalId]);

  const handleToggleAccepting = async () => {
    if (!hospital) return;
    try {
      const updated = await api.updateHospitalCapacity(hospitalId, {
        acceptingPatients: !hospital.capacity.acceptingPatients,
      });
      setHospital(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAccept = async (reservationId: string) => {
    try {
      await api.acceptHospitalReservation(hospitalId, reservationId);
      fetchHospitalData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingResvId || !rejectionReason.trim()) return;
    try {
      await api.rejectHospitalReservation(hospitalId, rejectingResvId, rejectionReason);
      setRejectingResvId(null);
      setRejectionReason('');
      fetchHospitalData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleTranscript = async (resv: BedReservation) => {
    if (expandedResvId === resv.id) {
      setExpandedResvId(null);
      return;
    }
    setExpandedResvId(resv.id);
    if (!reportsData[resv.incidentId]) {
      setReportLoading((prev) => ({ ...prev, [resv.incidentId]: true }));
      try {
        const rpt = await api.getClinicalReport(resv.incidentId);
        setReportsData((prev) => ({ ...prev, [resv.incidentId]: rpt }));
      } catch (err) {
        // If no report or error, just ignore for now or show 'Not available'
      } finally {
        setReportLoading((prev) => ({ ...prev, [resv.incidentId]: false }));
      }
    }
  };

  const handleFetchAiSummary = async (resv: BedReservation) => {
    setAiSummaryLoading((prev) => ({ ...prev, [resv.incidentId]: true }));
    try {
      const summary = await api.generateHospitalPreArrivalSummary(hospitalId, resv.incidentId);
      setAiSummaryData((prev) => ({ ...prev, [resv.incidentId]: summary }));
    } catch (err: any) {
      setAiSummaryData((prev) => ({
        ...prev,
        [resv.incidentId]: { status: 'ERROR', message: err.message },
      }));
    } finally {
      setAiSummaryLoading((prev) => ({ ...prev, [resv.incidentId]: false }));
    }
  };

  const mapMarkers: MapMarkerItem[] = [];
  if (hospital?.location) {
    mapMarkers.push({
      id: `hosp-${hospital.id}`,
      lat: hospital.location.latitude,
      lng: hospital.location.longitude,
      label: `Hospital: ${hospital.name}`,
      type: 'HOSPITAL',
      details: `ER Beds: ${hospital.capacity.availableEmergencyBeds} Avail`,
    });
  }

  return (
    <div className="app-view" style={{ padding: '1.5rem 1rem' }}>
      <div className="app-title-bar">
        <div className="app-title-info">
          <h1>
            <Building2 style={{ color: 'var(--accent-green)' }} size={28} /> Hospital ER Receiving Dashboard
          </h1>
          <p>Pre-arrival emergency bed reservations & capacity command control</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge-green" style={{ fontSize: '0.9rem', padding: '0.45rem 0.75rem' }}>
            ID: {hospitalId}
          </span>
          <button className="btn btn-secondary" onClick={fetchHospitalData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Sync Capacity
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
            <AlertTriangle size={22} />
            <div><strong>ER Error:</strong> {error}</div>
          </div>
        </div>
      )}

      {/* ER Capacity Summary Cards */}
      {hospital && (
        <div className="grid-4" style={{ marginBottom: '1.5rem', gap: '1rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Receiving Status</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span className={`badge badge-${hospital.capacity.acceptingPatients ? 'green' : 'red'}`} style={{ padding: '0.35rem 0.625rem' }}>
                {hospital.capacity.acceptingPatients ? 'ACCEPTING' : 'DIVERTED'}
              </span>
              <button className="btn btn-secondary" onClick={handleToggleAccepting} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: '700' }}>
                Toggle
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Bed size={15} color="var(--accent-green)" /> Available ER Beds
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', marginTop: '0.35rem' }}>
              {hospital.capacity.availableEmergencyBeds} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>/ {hospital.capacity.totalBeds} total</span>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <HeartPulse size={15} color="var(--accent-amber)" /> Available ICU Beds
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--accent-amber)', marginTop: '0.35rem' }}>
              {hospital.capacity.availableICUBeds}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Wind size={15} color="var(--accent-blue)" /> Ventilators
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--accent-blue)', marginTop: '0.35rem' }}>
              {hospital.capacity.availableVentilators}
            </div>
          </div>
        </div>
      )}

      {/* Hospital Location Map */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin color="var(--accent-green)" size={20} /> Hospital Receiving Position Map
          </span>
        </div>
        <LeafletMap
          markers={mapMarkers}
          height="260px"
          center={hospital?.location ? [hospital.location.latitude, hospital.location.longitude] : [12.9716, 77.5946]}
        />
      </div>

      {/* Incoming Bed Reservations */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '1.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bed color="var(--accent-blue)" size={20} /> Incoming Pre-Arrival Bed Reservations
          </span>
          <span className="badge badge-blue">{reservations.length} Active Requests</span>
        </div>

        {reservations.length === 0 ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
            <Bed className="empty-state-icon" color="var(--text-muted)" />
            <div className="empty-state-title">No Incoming Bed Reservations</div>
            <div className="empty-state-desc">Hospital {hospitalId} currently has no pending pre-arrival patient bed reservations</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reservations.map((resv) => (
              <div
                key={resv.id}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span className="badge badge-purple">{resv.bedType} BED</span>
                      <span className={`badge badge-${resv.status === 'CONFIRMED' ? 'green' : resv.status === 'REJECTED' ? 'red' : 'amber'}`}>
                        {resv.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Incident ID: {resv.incidentId}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span>Reservation ID: {resv.id} | Timestamp: {resv.requestedAt && !isNaN(new Date(resv.requestedAt).getTime()) ? new Date(resv.requestedAt).toLocaleTimeString() : 'Just now'}</span>
                      <button 
                        onClick={() => handleToggleTranscript(resv)} 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                      >
                        {expandedResvId === resv.id ? 'Hide Clinical Report' : 'View Clinical Report'}
                      </button>
                    </div>
                  </div>

                  {resv.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.625rem' }}>
                      <button className="btn btn-success" onClick={() => handleAccept(resv.id)}>
                        <CheckCircle size={16} /> Accept Bed
                      </button>
                      <button className="btn btn-danger" onClick={() => setRejectingResvId(resv.id)}>
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {expandedResvId === resv.id && (
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    {reportLoading[resv.incidentId] ? (
                      <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Loading clinical report...</div>
                    ) : reportsData[resv.incidentId] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div><strong style={{ color: 'var(--text-secondary)' }}>Triage Level:</strong> <span className="badge badge-red">{reportsData[resv.incidentId].triageLevel}</span></div>
                        <div>
                          <strong style={{ color: 'var(--text-secondary)' }}>Patient Condition Summary:</strong>
                          <div style={{ marginTop: '0.25rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>
                            {reportsData[resv.incidentId].patientConditionSummary}
                          </div>
                        </div>
                        {reportsData[resv.incidentId].vitals && (
                          <div>
                            <strong style={{ color: 'var(--text-secondary)' }}>Vitals:</strong>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                              <span>HR: {reportsData[resv.incidentId].vitals.heartRate || 'N/A'}</span>
                              <span>SpO2: {reportsData[resv.incidentId].vitals.oxygenSaturation || 'N/A'}%</span>
                              <span>BP: {reportsData[resv.incidentId].vitals.bloodPressureSystolic || 'N/A'}/{reportsData[resv.incidentId].vitals.bloodPressureDiastolic || 'N/A'}</span>
                              <span>GCS: {reportsData[resv.incidentId].vitals.glasgowComaScale || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                        {reportsData[resv.incidentId].transcriptionText && (
                          <div>
                            <strong style={{ color: 'var(--text-secondary)' }}>Voice Transcription:</strong>
                            <div style={{ marginTop: '0.25rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              "{reportsData[resv.incidentId].transcriptionText}"
                            </div>
                          </div>
                        )}

                        {/* AI Pre-Arrival Summary Section */}
                        <div style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid var(--accent-purple)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: '700', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Cpu size={16} /> Gemini Pre-Arrival Clinical Summary
                            </span>
                            {!aiSummaryData[resv.incidentId] && !aiSummaryLoading[resv.incidentId] && (
                              <button className="btn btn-secondary" onClick={() => handleFetchAiSummary(resv)} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                                Generate AI Summary
                              </button>
                            )}
                          </div>

                          {aiSummaryLoading[resv.incidentId] && (
                            <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Loader2 size={14} className="spin" /> Analyzing clinical telemetry...
                            </div>
                          )}

                          {aiSummaryData[resv.incidentId] && (
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.8rem', color: aiSummaryData[resv.incidentId].status === 'SUCCESS' ? 'var(--accent-purple)' : 'var(--accent-red)', marginBottom: '0.5rem' }}>
                                Status: {aiSummaryData[resv.incidentId].status} {aiSummaryData[resv.incidentId].message && `(${aiSummaryData[resv.incidentId].message})`}
                              </div>
                              
                              {aiSummaryData[resv.incidentId].status !== 'SUCCESS' && (
                                <div style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                  <AlertTriangle size={16} />
                                  <strong>AI pre-arrival assistance unavailable. Continue with the available incident and clinical information.</strong>
                                </div>
                              )}

                              {aiSummaryData[resv.incidentId].structuredSummary && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                                  <div><strong style={{ color: 'var(--text-secondary)' }}>Condition Severity:</strong> {aiSummaryData[resv.incidentId].structuredSummary.conditionSeverity}</div>
                                  <div><strong style={{ color: 'var(--text-secondary)' }}>Estimated ETA:</strong> {aiSummaryData[resv.incidentId].structuredSummary.estimatedETA}</div>
                                  
                                  {aiSummaryData[resv.incidentId].structuredSummary.preArrivalPreparations && aiSummaryData[resv.incidentId].structuredSummary.preArrivalPreparations.length > 0 && (
                                    <div>
                                      <strong style={{ color: 'var(--text-secondary)' }}>Preparation:</strong>
                                      <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                                        {aiSummaryData[resv.incidentId].structuredSummary.preArrivalPreparations.map((prep: string, i: number) => (
                                          <li key={i}>{prep}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {aiSummaryData[resv.incidentId].structuredSummary.criticalAlerts && aiSummaryData[resv.incidentId].structuredSummary.criticalAlerts.length > 0 && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <strong style={{ color: 'var(--accent-red)' }}>Critical Alerts:</strong>
                                      <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, color: 'var(--accent-red)' }}>
                                        {aiSummaryData[resv.incidentId].structuredSummary.criticalAlerts.map((alert: string, i: number) => (
                                          <li key={i}>{alert}</li>
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
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>No clinical report transmitted yet for this incident.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mandatory Rejection Dialog Modal */}
      {rejectingResvId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', borderColor: 'var(--accent-red)', boxShadow: 'var(--shadow-card-hover)' }}>
            <div className="card-title" style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>
              Mandatory Bed Rejection Reason
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '700' }}>Reason for Reservation Rejection</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Specify clinical justification (e.g. ICU at capacity, CT scanner maintenance)"
                  rows={3}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectingResvId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ fontWeight: '700' }}>
                  Confirm Rejection & Trigger Reroute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
