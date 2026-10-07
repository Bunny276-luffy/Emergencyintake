import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EmergencyIncident, Ambulance, Hospital } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { LeafletMap } from '../components/LeafletMap';
import type { MapMarkerItem, MapRouteItem } from '../components/LeafletMap';
import { Radio, Truck, Navigation, AlertTriangle, RefreshCw, Layers, ShieldAlert, Cpu, CheckCircle2, MapPin, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  who: string;
  what: string;
  timestamp: string;
}

export const DispatchCenterApp: React.FC = () => {
  const [incidents, setIncidents] = useState<EmergencyIncident[]>([]);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<EmergencyIncident | null>(null);
  const [assignedAmbulance, setAssignedAmbulance] = useState<Ambulance | null>(null);
  const [destinationHospital, setDestinationHospital] = useState<Hospital | null>(null);
  const [candidateHospitals, setCandidateHospitals] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Form State
  const [assignAmbulanceId, setAssignAmbulanceId] = useState('');
  const [assignHospitalId, setAssignHospitalId] = useState('');
  const [rerouteHospitalId, setRerouteHospitalId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');
  const [rerouteModalOpen, setRerouteModalOpen] = useState(false);

  // Dispatch Mode: Automatic (default) vs Manual Override
  const [activeTab, setActiveTab] = useState<'AUTO' | 'MANUAL'>('AUTO');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDispatchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeIncidents = await api.listActiveIncidents();
      const availAmbulances = await api.listAvailableAmbulances();
      setIncidents(activeIncidents);
      setAmbulances(availAmbulances);

      if (activeIncidents.length > 0) {
        if (!selectedIncident || !activeIncidents.some(i => i.id === selectedIncident.id)) {
          await handleSelectIncident(activeIncidents[0]);
        } else {
          // Re-fetch current selected incident details
          const current = activeIncidents.find(i => i.id === selectedIncident.id);
          if (current) await handleSelectIncident(current);
        }
      } else {
        setSelectedIncident(null);
        setAssignedAmbulance(null);
        setDestinationHospital(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedIncident]);

  const handleSelectIncident = async (incident: EmergencyIncident) => {
    setSelectedIncident(incident);
    setError(null);
    try {
      // Fetch rich details including assigned ambulance and destination hospital
      const details = await api.getIncidentDetails(incident.id);
      setSelectedIncident(details.incident);
      setAssignedAmbulance(details.assignedAmbulance || null);
      setDestinationHospital(details.destinationHospital || null);

      const candidates = await api.findCandidateHospitals(
        incident.location.latitude,
        incident.location.longitude,
        incident.priority === 'CRITICAL' ? 'ICU' : 'EMERGENCY'
      );
      setCandidateHospitals(candidates);

      // Load initial candidates into form state
      if (candidates.length > 0) {
        const firstHosp = getHospitalData(candidates[0]);
        setAssignHospitalId(firstHosp.id || '');
      }

      // Generate localized timeline from incident data
      const evts: TimelineEvent[] = [
        {
          id: `evt-1`,
          who: 'Citizen Reporter',
          what: `SOS Reported: ${incident.emergencyType} (${incident.description})`,
          timestamp: incident.createdAt,
        },
      ];
      if (details.incident.assignedAmbulanceId || details.assignedAmbulance) {
        evts.push({
          id: `evt-2`,
          who: 'Auto Dispatch Engine',
          what: `Assigned unit ${details.assignedAmbulance?.vehicleNumber || details.incident.assignedAmbulanceId}`,
          timestamp: details.incident.updatedAt,
        });
      }
      if (details.incident.destinationHospitalId || details.destinationHospital) {
        evts.push({
          id: `evt-3`,
          who: 'Auto Dispatch Engine',
          what: `Reserved bed at hospital ${details.destinationHospital?.name || details.incident.destinationHospitalId}`,
          timestamp: details.incident.updatedAt,
        });
      }
      setTimeline(evts);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchDispatchData();

    socketService.joinDispatcherRoom();

    const handleIncidentCreated = (inc: EmergencyIncident) => {
      setIncidents((prev) => [inc, ...prev]);
      fetchDispatchData();
    };

    const handleStatusUpdated = () => {
      fetchDispatchData();
    };

    const handleAutoDispatched = (_data: any) => {
      fetchDispatchData();
    };

    socketService.on('INCIDENT_CREATED', handleIncidentCreated);
    socketService.on('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
    socketService.on('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);

    return () => {
      socketService.off('INCIDENT_CREATED', handleIncidentCreated);
      socketService.off('AMBULANCE_STATUS_UPDATED', handleStatusUpdated);
      socketService.off('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);
      socketService.leaveRoom('dispatcher-room');
    };
  }, [fetchDispatchData]);

  const handleExecuteAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !assignAmbulanceId) {
      setError('Please select an incident and an ambulance');
      return;
    }
    setError(null);
    try {
      await api.assignAmbulance({
        incidentId: selectedIncident.id,
        ambulanceId: assignAmbulanceId,
        hospitalId: assignHospitalId || undefined,
      });

      if (assignHospitalId) {
        await api.createHospitalReservation(
          selectedIncident.id,
          assignHospitalId,
          selectedIncident.priority === 'CRITICAL' ? 'ICU' : 'EMERGENCY'
        );
      }

      await fetchDispatchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExecuteReroute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !selectedIncident.assignedAmbulanceId || !rerouteHospitalId || !rerouteReason.trim()) {
      setError('Please select a new hospital and specify a reroute reason');
      return;
    }
    setError(null);
    try {
      await api.executeEmergencyReroute({
        incidentId: selectedIncident.id,
        ambulanceId: selectedIncident.assignedAmbulanceId,
        newHospitalId: rerouteHospitalId,
        reason: rerouteReason,
      });
      setRerouteModalOpen(false);
      setRerouteReason('');
      await fetchDispatchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Safe helper to unpack candidate hospital data
  const getHospitalData = (item: any): { id: string; name: string; availableEmergencyBeds: number; availableICUBeds: number; location?: { latitude: number; longitude: number } } => {
    if (!item) return { id: '', name: 'Unknown Hospital', availableEmergencyBeds: 0, availableICUBeds: 0 };
    const h = item.hospital || item;
    return {
      id: h.id || item.id || '',
      name: h.name || item.name || 'Emergency Hospital',
      availableEmergencyBeds: h.capacity?.availableEmergencyBeds ?? h.availableEmergencyBeds ?? 0,
      availableICUBeds: h.capacity?.availableICUBeds ?? h.availableICUBeds ?? 0,
      location: h.location || (typeof h.latitude === 'number' ? { latitude: h.latitude, longitude: h.longitude } : undefined),
    };
  };

  // Build Leaflet Map Data
  const mapMarkers: MapMarkerItem[] = [];
  const mapRoutes: MapRouteItem[] = [];

  // 1. Incidents
  incidents.forEach((inc) => {
    if (inc.location) {
      mapMarkers.push({
        id: `inc-${inc.id}`,
        lat: inc.location.latitude,
        lng: inc.location.longitude,
        label: `Incident: ${inc.emergencyType}`,
        type: 'INCIDENT',
        details: `${inc.description} (${inc.status})`,
      });
    }
  });

  // 2. Ambulances
  ambulances.forEach((amb) => {
    if (amb.currentLocation) {
      mapMarkers.push({
        id: `amb-${amb.id}`,
        lat: amb.currentLocation.latitude,
        lng: amb.currentLocation.longitude,
        label: `Ambulance: ${amb.vehicleNumber}`,
        type: 'AMBULANCE',
        details: `Driver: ${amb.driverName} (${amb.status})`,
      });
    }
  });

  // 3. Hospitals
  candidateHospitals.forEach((item) => {
    const h = getHospitalData(item);
    if (h && h.location) {
      mapMarkers.push({
        id: `hosp-${h.id}`,
        lat: h.location.latitude,
        lng: h.location.longitude,
        label: `Hospital: ${h.name}`,
        type: 'HOSPITAL',
        details: `Available Emergency Beds: ${h.availableEmergencyBeds}`,
      });
    }
  });

  // Selected Incident Route Lines
  if (selectedIncident && selectedIncident.location) {
    const incPos: [number, number] = [selectedIncident.location.latitude, selectedIncident.location.longitude];
    const targetAmb = assignedAmbulance || ambulances.find((a) => a.id === selectedIncident.assignedAmbulanceId);
    if (targetAmb && targetAmb.currentLocation) {
      mapRoutes.push({
        from: [targetAmb.currentLocation.latitude, targetAmb.currentLocation.longitude],
        to: incPos,
        color: '#ef4444',
      });
    }
  }

  const topCandidate = destinationHospital ? { name: destinationHospital.name, availableEmergencyBeds: destinationHospital.capacity?.availableEmergencyBeds ?? 40 } : (candidateHospitals[0] ? getHospitalData(candidateHospitals[0]) : null);
  const activeAmbulanceUnit = assignedAmbulance || ambulances[0];

  return (
    <div className="app-view" style={{ padding: '1.5rem 1rem' }}>
      <div className="app-title-bar">
        <div className="app-title-info">
          <h1>
            <Radio style={{ color: 'var(--accent-red)' }} size={28} /> 108 Dispatch Command Console
          </h1>
          <p>Automation-First emergency triage, spatial PostGIS dispatch & live operational map</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDispatchData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Dispatch View
        </button>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
            <AlertTriangle size={22} />
            <div><strong>Dispatch Control Error:</strong> {error}</div>
          </div>
        </div>
      )}

      {/* Dispatch Mode Selector */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'AUTO' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('AUTO')}
          style={{ fontWeight: '700' }}
        >
          <Cpu size={18} /> Automatic Dispatch Mode
        </button>
        <button
          className={`btn ${activeTab === 'MANUAL' ? 'btn-danger' : 'btn-secondary'}`}
          onClick={() => setActiveTab('MANUAL')}
          style={{ fontWeight: '700' }}
        >
          <ShieldAlert size={18} /> Manual Override Controls
        </button>
      </div>

      <div className="grid-3" style={{ gap: '1.5rem' }}>
        {/* Active Incidents List Column */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span>Active Incidents</span>
            <span className="badge badge-red">{incidents.length} Active</span>
          </div>

          {incidents.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
              <Radio className="empty-state-icon" color="var(--text-muted)" />
              <div className="empty-state-title">No Active Incidents</div>
              <div className="empty-state-desc">108 Dispatch currently has zero unassigned or active emergency cases</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '620px', overflowY: 'auto' }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => handleSelectIncident(inc)}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: selectedIncident?.id === inc.id ? 'var(--accent-blue)' : 'var(--border-color)',
                    backgroundColor: selectedIncident?.id === inc.id ? 'var(--accent-blue-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span className="badge badge-red">{inc.emergencyType}</span>
                    <span className="badge badge-blue">{inc.status}</span>
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>{inc.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    ID: {inc.id} | Reported: {new Date(inc.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Incident & Automation/Map Command Panel Column */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span>Dispatch Command & Spatial Map Console</span>
            {selectedIncident && <span className="badge badge-blue">ID: {selectedIncident.id}</span>}
          </div>

          {!selectedIncident ? (
            <div className="empty-state" style={{ padding: '4rem 1rem' }}>
              <Layers className="empty-state-icon" color="var(--text-muted)" />
              <div className="empty-state-title">No Incident Selected</div>
              <div className="empty-state-desc">Select an active emergency incident from the left list to inspect automated recommendations or manual override controls</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Incident Header Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-red">{selectedIncident.emergencyType}</span>
                  <span className="badge badge-amber">{selectedIncident.priority} PRIORITY</span>
                  <span className="badge badge-blue">{selectedIncident.status}</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{selectedIncident.description}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Location: {selectedIncident.location?.address || `${selectedIncident.location?.latitude ?? ''}, ${selectedIncident.location?.longitude ?? ''}`}
                </div>
              </div>

              {/* AUTO DISPATCH DECISION PANEL */}
              {activeTab === 'AUTO' ? (
                <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-blue)', boxShadow: '0 2px 10px rgba(59, 130, 246, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                      <Cpu size={20} /> AUTO DISPATCH DECISION ENGINE
                    </div>
                    <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>✓ AUTO DISPATCH ACTIVE</span>
                  </div>

                  <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                    {/* Assigned Ambulance */}
                    <div style={{ padding: '0.875rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Assigned Ambulance Unit</div>
                      {activeAmbulanceUnit ? (
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{activeAmbulanceUnit.vehicleNumber} ({activeAmbulanceUnit.driverName})</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Status: <span className="badge badge-green">{activeAmbulanceUnit.status}</span>
                          </div>
                          <div style={{ marginTop: '0.5rem' }}>
                            <Link
                              to={`/ambulance?ambulanceId=${activeAmbulanceUnit.id}`}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Truck size={13} /> Open Driver Console ({activeAmbulanceUnit.id}) →
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching PostGIS fleet...</div>
                      )}
                    </div>

                    {/* Receiving Hospital */}
                    <div style={{ padding: '0.875rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Receiving Hospital Destination</div>
                      {topCandidate ? (
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{topCandidate.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Emergency Beds: <span className="badge badge-green">{topCandidate.availableEmergencyBeds} Available</span></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching hospital capacity...</div>
                      )}
                    </div>
                  </div>

                  {/* Advisory ML ETA */}
                  {selectedIncident?.mlETAPrediction && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Clock size={18} color="var(--accent-blue)" />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>ML-assisted ETA estimate: {selectedIncident.mlETAPrediction.predictedEtaMinutes} minutes</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Advisory estimate (Model: {selectedIncident.mlETAPrediction.modelVersion}) | MAE-based estimated uncertainty range: {selectedIncident.mlETAPrediction.lowerBound}-{selectedIncident.mlETAPrediction.upperBound} min
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Criteria Checklist */}
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={15} /> Incident classified ({selectedIncident.emergencyType} - {selectedIncident.priority} Priority)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={15} /> PostGIS spatial proximity & availability evaluated
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={15} /> Destination hospital capacity & bed reservation verified
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={15} /> Real-time telemetry broadcasted via WebSockets
                    </div>
                  </div>
                </div>
              ) : (
                /* MANUAL OVERRIDE CONTROLS */
                <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-red)', boxShadow: '0 2px 10px rgba(239, 68, 68, 0.1)' }}>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--accent-red)', fontFamily: 'var(--font-heading)' }}>
                    Manual Override: Force Ambulance Assignment & Bed Reservation
                  </div>
                  <form onSubmit={handleExecuteAssignment} className="grid-2" style={{ gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700' }}>Available Ambulance</label>
                      <select value={assignAmbulanceId} onChange={(e) => setAssignAmbulanceId(e.target.value)} required>
                        <option value="">Select Ambulance Unit...</option>
                        {ambulances.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.vehicleNumber} ({a.driverName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700' }}>Destination Hospital Candidate</label>
                      <select value={assignHospitalId} onChange={(e) => setAssignHospitalId(e.target.value)}>
                        <option value="">Select Candidate Hospital...</option>
                        {candidateHospitals.map((item) => {
                          const h = getHospitalData(item);
                          return (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.availableEmergencyBeds} Beds Avail)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.875rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: '700' }}>
                        <Truck size={18} /> Execute Manual Assignment & Bed Reservation
                      </button>
                      {selectedIncident.assignedAmbulanceId && (
                        <button type="button" className="btn btn-danger" onClick={() => setRerouteModalOpen(true)} style={{ fontWeight: '700' }}>
                          <Navigation size={18} /> Execute Emergency Reroute
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* OPERATIONAL DISPATCH LEAFLET MAP */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={16} color="var(--accent-red)" /> Spatial Command Map Visualization
                </div>
                <LeafletMap
                  markers={mapMarkers}
                  routes={mapRoutes}
                  height="340px"
                  center={selectedIncident.location ? [selectedIncident.location.latitude, selectedIncident.location.longitude] : [12.9716, 77.5946]}
                />
              </div>

              {/* Operational Audit Timeline */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Incident Operational Audit Timeline
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {timeline.map((entry) => (
                    <div key={entry.id} style={{ fontSize: '0.8rem', padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--accent-blue)' }}>[{new Date(entry.timestamp).toLocaleTimeString()}]</strong> {entry.who} - {entry.what}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Reroute Decision Modal */}
      {rerouteModalOpen && selectedIncident && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', borderColor: 'var(--accent-red)', boxShadow: 'var(--shadow-card-hover)' }}>
            <div className="card-title" style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>
              Execute Emergency Hospital Reroute
            </div>
            <form onSubmit={handleExecuteReroute}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '700' }}>Select Alternative Hospital Destination</label>
                <select value={rerouteHospitalId} onChange={(e) => setRerouteHospitalId(e.target.value)} required>
                  <option value="">Select Destination Hospital...</option>
                  {candidateHospitals.map((item) => {
                    const h = getHospitalData(item);
                    return (
                      <option key={h.id} value={h.id}>
                        {h.name} (Emergency Beds: {h.availableEmergencyBeds})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '700' }}>Mandatory Reroute Justification</label>
                <textarea
                  value={rerouteReason}
                  onChange={(e) => setRerouteReason(e.target.value)}
                  placeholder="State operational reason (e.g. initial hospital trauma ward diverted, patient vitals worsened requiring level-1 ICU)"
                  rows={3}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRerouteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ fontWeight: '700' }}>
                  Transmit Reroute Telemetry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
