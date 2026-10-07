import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EmergencyIncident, Ambulance, AmbulanceStatus } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { LeafletMap } from '../components/LeafletMap';
import type { MapMarkerItem, MapRouteItem } from '../components/LeafletMap';
import { Truck, CheckCircle, Navigation, MapPin, Clock, AlertTriangle, RefreshCw, Stethoscope } from 'lucide-react';
import { useAuth } from '../App';

export const AmbulanceDriverApp: React.FC = () => {
  const { user } = useAuth();
  const ambulanceId = user?.ambulanceId;

  const [ambulance, setAmbulance] = useState<Ambulance | null>(null);
  const [incident, setIncident] = useState<EmergencyIncident | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local state to track which incidents have had Step 1 acknowledged on the client
  const [acknowledgedIncidents, setAcknowledgedIncidents] = useState<Record<string, boolean>>({});

  // GPS Simulation State
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const [liveGpsEnabled, setLiveGpsEnabled] = useState(false);
  const watchIdRef = React.useRef<number | null>(null);

  // Remove searchParams sync

  const fetchDriverState = async () => {
    if (!ambulanceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAmbulanceAssignment(ambulanceId);
      setAmbulance(data.ambulance);
      setIncident(data.incident || null);
      if (data.ambulance?.currentLocation) {
        setLatInput(String(data.ambulance.currentLocation.latitude));
        setLngInput(String(data.ambulance.currentLocation.longitude));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverState();

    socketService.joinAmbulanceRoom(ambulanceId);

    const handleAssigned = (data: { ambulanceId: string; incident: EmergencyIncident }) => {
      if (data.ambulanceId === ambulanceId) {
        fetchDriverState();
      }
    };

    const handleRerouted = (data: { ambulanceId: string; newHospitalId: string }) => {
      if (data.ambulanceId === ambulanceId) {
        fetchDriverState();
      }
    };

    const handleAutoDispatched = (data: any) => {
      if (data?.ambulance?.id) {
        // If current ambulance has no active assignment, sync
        if (data.ambulance.id === ambulanceId) {
          fetchDriverState();
        }
      } else {
        fetchDriverState();
      }
    };

    socketService.on('AMBULANCE_ASSIGNED', handleAssigned);
    socketService.on('HOSPITAL_REROUTED', handleRerouted);
    socketService.on('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);

    return () => {
      socketService.off('AMBULANCE_ASSIGNED', handleAssigned);
      socketService.off('HOSPITAL_REROUTED', handleRerouted);
      socketService.off('AUTOMATIC_DISPATCH_EXECUTED', handleAutoDispatched);
      socketService.leaveRoom(`ambulance-room:${ambulanceId}`);
    };
  }, [ambulanceId]);

  useEffect(() => {
    if (liveGpsEnabled) {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLatInput(lat.toFixed(6));
            setLngInput(lng.toFixed(6));
            api.updateAmbulanceLocation(ambulanceId, {
              latitude: lat,
              longitude: lng,
            }).catch(e => console.error('Failed to auto-update GPS', e));
          },
          (err) => {
            console.error('GPS watch error', err);
            setLiveGpsEnabled(false);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      } else {
        setLiveGpsEnabled(false);
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [liveGpsEnabled, ambulanceId]);

  const handleAcknowledge = async () => {
    try {
      await api.acknowledgeAmbulanceAssignment(ambulanceId);
      if (incident) {
        setAcknowledgedIncidents((prev) => ({ ...prev, [incident.id]: true }));
      }
      await fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArrivePatient = async () => {
    try {
      await api.arriveAtPatient(ambulanceId);
      fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDepartPatient = async () => {
    try {
      await api.departWithPatient(ambulanceId);
      fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArriveHospital = async () => {
    try {
      await api.arriveAtHospital(ambulanceId);
      fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCompleteHandoff = async () => {
    try {
      await api.completeHospitalHandoff(ambulanceId);
      fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateLocation = async () => {
    try {
      await api.updateAmbulanceLocation(ambulanceId, {
        latitude: parseFloat(latInput),
        longitude: parseFloat(lngInput),
      });
      fetchDriverState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Check acknowledgement status for the active incident
  const isAcknowledged = Boolean(
    incident &&
      (acknowledgedIncidents[incident.id] ||
        incident.status === 'PATIENT_PICKED_UP' ||
        incident.status === 'TRANSPORTING' ||
        incident.status === 'ARRIVED_AT_HOSPITAL' ||
        incident.status === 'HANDOFF_COMPLETED')
  );

  // Workflow step determination
  const step1Active = Boolean(incident && (ambulance?.status === 'ASSIGNED' || incident.status === 'DISPATCHED') && !isAcknowledged);
  const step1Done = isAcknowledged;

  const step2Active = Boolean(incident && isAcknowledged && (incident.status === 'REPORTED' || incident.status === 'DISPATCHED'));
  const step2Done = Boolean(incident && (incident.status === 'PATIENT_PICKED_UP' || incident.status === 'TRANSPORTING' || incident.status === 'ARRIVED_AT_HOSPITAL' || incident.status === 'HANDOFF_COMPLETED'));

  const step3Active = Boolean(incident && incident.status === 'PATIENT_PICKED_UP');
  const step3Done = Boolean(incident && (incident.status === 'TRANSPORTING' || incident.status === 'ARRIVED_AT_HOSPITAL' || incident.status === 'HANDOFF_COMPLETED'));

  const step4Active = Boolean(incident && incident.status === 'TRANSPORTING');
  const step4Done = Boolean(incident && (incident.status === 'ARRIVED_AT_HOSPITAL' || incident.status === 'HANDOFF_COMPLETED'));

  const step5Active = Boolean(incident && incident.status === 'ARRIVED_AT_HOSPITAL');
  const step5Done = Boolean(incident && incident.status === 'HANDOFF_COMPLETED');

  // Dynamically resolve overall current status
  const currentStatus = incident?.status || ambulance?.status || 'AVAILABLE';

  // Build Leaflet Map Data for Driver
  const mapMarkers: MapMarkerItem[] = [];
  const mapRoutes: MapRouteItem[] = [];

  if (ambulance?.currentLocation) {
    mapMarkers.push({
      id: `amb-${ambulance.id}`,
      lat: ambulance.currentLocation.latitude,
      lng: ambulance.currentLocation.longitude,
      label: `Unit: ${ambulance.vehicleNumber}`,
      type: 'AMBULANCE',
      details: `Status: ${currentStatus}`,
    });
  }

  if (incident?.location) {
    mapMarkers.push({
      id: `inc-${incident.id}`,
      lat: incident.location.latitude,
      lng: incident.location.longitude,
      label: `Pickup Scene: ${incident.emergencyType}`,
      type: 'INCIDENT',
      details: incident.location.address || incident.description,
    });

    if (ambulance?.currentLocation) {
      mapRoutes.push({
        from: [ambulance.currentLocation.latitude, ambulance.currentLocation.longitude],
        to: [incident.location.latitude, incident.location.longitude],
        color: '#ef4444',
      });
    }
  }

  return (
    <div className="app-view" style={{ padding: '1.5rem 1rem' }}>
      <div className="app-title-bar">
        <div className="app-title-info">
          <h1>
            <Truck style={{ color: 'var(--accent-blue)' }} size={28} /> Ambulance Driver Mobile Console
          </h1>
          <p>Touch-optimized vehicle navigation & operational handoff workflow</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '0.45rem 0.75rem' }}>
            ID: {ambulanceId}
          </span>
          <button className="btn btn-secondary" onClick={fetchDriverState} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Sync State
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
            <AlertTriangle size={22} />
            <div>
              <strong>Action Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Driver & Vehicle Telemetry Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Vehicle Unit</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', fontFamily: 'var(--font-heading)', marginTop: '0.2rem' }}>
              {ambulance ? `${ambulance.vehicleNumber} (${ambulance.driverName})` : ambulanceId}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Operational Status</div>
            <span className={`badge badge-${currentStatus === 'AVAILABLE' || currentStatus === 'HANDOFF_COMPLETED' ? 'green' : currentStatus === 'ASSIGNED' || currentStatus === 'DISPATCHED' ? 'amber' : 'blue'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', marginTop: '0.2rem' }}>
              {currentStatus}
            </span>
          </div>
          <div>
            <div style={{ fontSize: '0.775rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>Estimated Route ETA</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-amber)', marginTop: '0.2rem' }}>
              {ambulance?.etaSeconds ? `${Math.round(ambulance.etaSeconds / 60)} mins` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Live Map Panel for Field Driver */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}>
          <span>Field Driver Route Navigation Map</span>
          {incident && <span className="badge badge-amber">GPS TRACKING ACTIVE</span>}
        </div>
        <LeafletMap
          markers={mapMarkers}
          routes={mapRoutes}
          height="280px"
          center={ambulance?.currentLocation ? [ambulance.currentLocation.latitude, ambulance.currentLocation.longitude] : [12.9716, 77.5946]}
        />
      </div>

      {/* Main Responsive Grid: Active Assignment & Touch Action Panel */}
      <div className="grid-2" style={{ gap: '1.5rem' }}>
        {/* Active Assignment Information */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Navigation size={20} color="var(--accent-blue)" /> Active Incident Assignment
              </span>
              {incident && <span className="badge badge-red">{incident.priority} PRIORITY</span>}
            </div>

            {incident ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <span className="badge badge-amber" style={{ marginBottom: '0.5rem' }}>{incident.emergencyType}</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>{incident.description}</div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <MapPin size={16} color="var(--accent-red)" /> Pickup Location
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '1.05rem', marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                    {incident.location.address || `${incident.location.latitude}, ${incident.location.longitude}`}
                  </div>
                </div>

                {incident.destinationHospitalId && (
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination Hospital</div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--accent-green)', marginTop: '0.35rem' }}>
                      Hospital ID: {incident.destinationHospitalId}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '0.25rem' }}>
                  <Link
                    to={`/paramedic?incidentId=${incident.id}`}
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                  >
                    <Stethoscope size={16} /> Open Paramedic Clinical Workspace →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                <Truck className="empty-state-icon" color="var(--text-muted)" />
                <div className="empty-state-title">No Active Emergency Assignment</div>
                <div className="empty-state-desc">Ambulance {ambulanceId} is currently available for dispatch assignment</div>
              </div>
            )}
          </div>
        </div>

        {/* Driver Touch Action Panel */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span>Driver Workflow Actions</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {/* Step 1 */}
            <button
              className={`btn ${step1Active ? 'btn-primary' : 'btn-secondary'} btn-lg`}
              onClick={handleAcknowledge}
              disabled={!incident || step1Done}
              style={{ fontWeight: '700', justifyContent: 'flex-start', paddingLeft: '1.25rem' }}
            >
              <CheckCircle size={20} color={step1Done ? 'var(--accent-green)' : 'currentColor'} />
              {step1Done ? '✓ 1. Assignment Acknowledged' : '1. Acknowledge Assignment'}
            </button>

            {/* Step 2 */}
            <button
              className={`btn ${step2Active ? 'btn-primary' : 'btn-secondary'} btn-lg`}
              onClick={handleArrivePatient}
              disabled={!incident || !step1Done || !step2Active}
              style={{ fontWeight: '700', justifyContent: 'flex-start', paddingLeft: '1.25rem' }}
            >
              <MapPin size={20} color={step2Done ? 'var(--accent-green)' : 'var(--accent-amber)'} />
              {step2Done ? '✓ 2. Arrived at Scene' : '2. Arrived at Scene'}
            </button>

            {/* Step 3 */}
            <button
              className={`btn ${step3Active ? 'btn-primary' : 'btn-secondary'} btn-lg`}
              onClick={handleDepartPatient}
              disabled={!incident || !step3Active}
              style={{ fontWeight: '700', justifyContent: 'flex-start', paddingLeft: '1.25rem' }}
            >
              <Navigation size={20} color={step3Done ? 'var(--accent-green)' : 'var(--accent-blue)'} />
              {step3Done ? '✓ 3. Departed with Patient' : '3. Depart with Patient'}
            </button>

            {/* Step 4 */}
            <button
              className={`btn ${step4Active ? 'btn-primary' : 'btn-secondary'} btn-lg`}
              onClick={handleArriveHospital}
              disabled={!incident || !step4Active}
              style={{ fontWeight: '700', justifyContent: 'flex-start', paddingLeft: '1.25rem' }}
            >
              <Clock size={20} color={step4Done ? 'var(--accent-green)' : 'var(--accent-purple)'} />
              {step4Done ? '✓ 4. Arrived at Hospital' : '4. Arrived at Hospital'}
            </button>

            {/* Step 5 */}
            <button
              className={`btn ${step5Active ? 'btn-success' : 'btn-secondary'} btn-lg`}
              onClick={handleCompleteHandoff}
              disabled={!incident || !step5Active}
              style={{ fontWeight: '700', justifyContent: 'flex-start', paddingLeft: '1.25rem' }}
            >
              <CheckCircle size={20} color={step5Done ? 'var(--accent-green)' : 'currentColor'} />
              {step5Done ? '✓ 5. Hospital Handoff Completed' : '5. Complete Hospital Handoff'}
            </button>
          </div>

          {/* Live GPS Telemetry Update */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.775rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                GPS Location Telemetry
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', color: liveGpsEnabled ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={liveGpsEnabled} 
                  onChange={(e) => setLiveGpsEnabled(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                /> 
                {liveGpsEnabled ? 'Live GPS Active' : 'Use Device GPS'}
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Lat"
                style={{ flex: 1 }}
              />
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="Lng"
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleUpdateLocation} style={{ whiteSpace: 'nowrap' }}>
                Update GPS
              </button>
            </div>
            {(!latInput || !lngInput) && (
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: '0.5rem', fontWeight: '700' }}>
                Live location unavailable
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
