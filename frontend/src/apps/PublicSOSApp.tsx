import React, { useState } from 'react';
import type { EmergencyIncident } from '../types';
import { api } from '../services/api';
import { AlertCircle, MapPin, CheckCircle, Search, AlertTriangle, Send, Loader2, User, Phone, ShieldAlert, HeartPulse } from 'lucide-react';

export const PublicSOSApp: React.FC = () => {
  const [emergencyType, setEmergencyType] = useState('ACCIDENT');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [reporterContact, setReporterContact] = useState('');

  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [bloodType, setBloodType] = useState('O+');

  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<'IDLE' | 'SUBMITTING' | 'RETRYING' | 'SUCCESS' | 'CONFIRMED_FAILURE' | 'NETWORK_FAILURE'>('IDLE');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  
  const [submittedIncident, setSubmittedIncident] = useState<EmergencyIncident | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Incident Lookup State
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<EmergencyIncident | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      setGpsLoading(true);
      setGpsError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude.toFixed(6));
          setLongitude(pos.coords.longitude.toFixed(6));
          setAddress('Current Device Location (Auto GPS)');
          setGpsLoading(false);
        },
        (err) => {
          console.warn('GPS Error:', err);
          let errMsg = 'Location access denied or unavailable.';
          if (err.code === 1) errMsg = 'Location permission denied. Please enter manually.';
          if (err.code === 2) errMsg = 'Location position unavailable. Please enter manually.';
          if (err.code === 3) errMsg = 'Location request timed out.';
          setGpsError(errMsg);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsError('Geolocation is not supported by your browser.');
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleSubmitSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitStatus === 'SUBMITTING' || submitStatus === 'RETRYING') return;

    let currentKey = idempotencyKey;
    if (!currentKey) {
      currentKey = crypto.randomUUID();
      setIdempotencyKey(currentKey);
    }

    setLoading(true);
    setError(null);
    setSubmitStatus('SUBMITTING');
    setRetryCount(0);

    const maxRetries = 2;
    let attempt = 0;

    const payload = {
      emergencyType,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
      },
      description,
      reporterContact,
      idempotencyKey: currentKey,
      patientInfo: patientName
        ? {
            name: patientName,
            age: patientAge ? parseInt(patientAge, 10) : undefined,
            gender: patientGender,
            knownMedicalConditions: medicalConditions ? medicalConditions.split(',').map((s) => s.trim()) : [],
            allergies: allergies ? allergies.split(',').map((s) => s.trim()) : [],
            bloodType,
          }
        : undefined,
    };

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          setSubmitStatus('RETRYING');
          setRetryCount(attempt);
          await sleep(2000 * attempt); // Exponential backoff
        }
        
        const res = await api.createPublicSOS(payload);
        setSubmittedIncident(res.incident);
        setSubmitStatus('SUCCESS');
        setIdempotencyKey(''); // reset for future emergencies
        setLoading(false);
        return; // Success, exit loop
      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error';
        const isNetworkFailure = errorMsg.includes('unreachable') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch');
        const isConflict = errorMsg.toLowerCase().includes('conflict');
        
        // Don't retry on 400, 401, 403, 409
        if (isConflict || (!isNetworkFailure && attempt === 0 && !errorMsg.includes('timeout'))) {
          setError(errorMsg);
          setSubmitStatus('CONFIRMED_FAILURE');
          setLoading(false);
          return;
        }

        attempt++;
        if (attempt > maxRetries) {
          setError('Unable to confirm the emergency request after multiple attempts due to network failure. The request may have been received. Please try again or use the available emergency calling option.');
          setSubmitStatus('NETWORK_FAILURE');
          setLoading(false);
        }
      }
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await api.getPublicIncident(lookupId.trim());
      setLookupResult(res);
    } catch (err: any) {
      setLookupError(err.message);
    }
  };

  return (
    <div className="app-view" style={{ maxWidth: '840px', padding: '1.5rem 1rem' }}>
      {/* Header Banner */}
      <div className="app-title-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="app-title-info">
          <h1>
            <AlertCircle size={28} color="var(--accent-red)" /> Citizens Public SOS Gateway
          </h1>
          <p>Direct 108 Emergency Dispatch Transmission & Tracking Portal</p>
        </div>
      </div>

      {error && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-red)' }}>
            <AlertTriangle size={22} />
            <div><strong>Submission Failed:</strong> {error}</div>
          </div>
        </div>
      )}

      {submittedIncident ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', borderColor: 'var(--accent-green)', boxShadow: 'var(--shadow-card-hover)' }}>
          <CheckCircle size={60} color="var(--accent-green)" style={{ margin: '0 auto 1.25rem auto' }} />
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--accent-green)', marginBottom: '0.5rem' }}>
            EMERGENCY SOS SIGNAL TRANSMITTED
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 1.75rem auto', lineHeight: '1.5' }}>
            108 Emergency Dispatch Center has received your report and is locating the nearest available ambulance unit.
          </p>

          <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.75rem', textAlign: 'left', lineHeight: '1.8' }}>
            <div><strong>Incident Tracking ID:</strong> <span style={{ color: 'var(--accent-blue)', fontWeight: '700', fontSize: '1.05rem', marginLeft: '0.5rem' }}>{submittedIncident.id}</span></div>
            <div><strong>Status:</strong> <span className="badge badge-blue" style={{ marginLeft: '0.5rem' }}>{submittedIncident.status}</span></div>
            <div><strong>Emergency Type:</strong> <span style={{ marginLeft: '0.5rem' }}>{submittedIncident.emergencyType}</span></div>
            <div><strong>Reported Location:</strong> <span style={{ marginLeft: '0.5rem' }}>{submittedIncident.location.address}</span></div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => setSubmittedIncident(null)}>
            Submit Another Emergency Signal
          </button>
        </div>
      ) : (
        /* Emergency SOS Submission Form */
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ paddingBottom: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldAlert size={22} color="var(--accent-red)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
              Report Emergency Scene
            </h2>
          </div>

          <form onSubmit={handleSubmitSOS}>
            {/* Step 1: Emergency Type Selection */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--accent-red)' }}>
                1. Select Emergency Type
              </label>
              <select
                value={emergencyType}
                onChange={(e) => setEmergencyType(e.target.value)}
                style={{ padding: '0.875rem', fontWeight: '600', fontSize: '1rem', backgroundColor: 'var(--bg-primary)' }}
              >
                <option value="ACCIDENT">🚨 Road Accident / Vehicle Collision</option>
                <option value="STEMI">🫀 Acute Heart Attack / Cardiac STEMI</option>
                <option value="STROKE">🧠 Stroke / Facial Droop & Speech Difficulty</option>
                <option value="MAJOR_TRAUMA">🩸 Severe Physical Trauma / Fall</option>
                <option value="RESPIRATORY_DISTRESS">🫁 Severe Breathing Distress</option>
                <option value="CARDIAC_ARREST">⚠️ Cardiac Arrest / Unresponsive</option>
                <option value="GENERAL_EMERGENCY">🚑 General Medical Emergency</option>
              </select>
            </div>

            {/* Step 2: Location Information */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                2. Location Information
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address or landmark"
                  style={{ flex: 1 }}
                  required
                />
                <button type="button" className="btn btn-secondary" onClick={handleUseCurrentLocation} style={{ whiteSpace: 'nowrap' }} disabled={gpsLoading}>
                  {gpsLoading ? <Loader2 size={16} className="spin" /> : <MapPin size={16} color="var(--accent-blue)" />} Auto GPS
                </button>
              </div>
              {gpsError && (
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-red)', marginBottom: '0.5rem', fontWeight: '600' }}>
                  {gpsError}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude" style={{ flex: '1 1 calc(50% - 0.5rem)', minWidth: '120px', fontSize: '0.85rem' }} />
                <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude" style={{ flex: '1 1 calc(50% - 0.5rem)', minWidth: '120px', fontSize: '0.85rem' }} />
              </div>
            </div>

            {/* Step 3: Emergency Description */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                3. Emergency Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scene, number of victims, severity..."
                required
              />
            </div>

            {/* Step 4: Reporter Contact */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                4. Reporter Callback Phone Number
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={18} color="var(--text-muted)" />
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="+91 Mobile number for 108 dispatch callback"
                  style={{ flex: 1 }}
                  required
                />
              </div>
            </div>

            {/* Optional Patient Medical Information */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                <HeartPulse size={18} color="var(--accent-purple)" />
                Optional Patient Medical Information (If known)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
                <input type="text" style={{ flex: '1 1 100%' }} value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient Name" />
                <input type="number" style={{ flex: '1 1 calc(50% - 0.5rem)' }} value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Age" />
                <input type="text" style={{ flex: '1 1 100%' }} value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="Known Medical Conditions" />
                <input type="text" style={{ flex: '1 1 100%' }} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Allergies" />
              </div>
            </div>

            <button type="submit" className="btn btn-danger btn-lg" style={{ width: '100%', fontWeight: '800', letterSpacing: '0.03em' }} disabled={loading}>
              {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
              {submitStatus === 'SUBMITTING' ? 'TRANSMITTING EMERGENCY SIGNAL...' : 
               submitStatus === 'RETRYING' ? `CONNECTION UNCERTAIN. RETRYING (${retryCount}/2)...` : 
               'SEND SOS EMERGENCY SIGNAL NOW'}
            </button>
          </form>
        </div>
      )}

      {/* Incident Status Lookup Section */}
      <div className="card" style={{ borderTop: '3px solid var(--accent-blue)' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={20} color="var(--accent-blue)" /> Track Incident Status
          </span>
        </div>
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Enter Incident Tracking ID (e.g. INC-101)"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
            Check Status
          </button>
        </form>

        {lookupError && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--accent-red-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)', fontSize: '0.875rem' }}>
            {lookupError}
          </div>
        )}

        {lookupResult && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', lineHeight: '1.8' }}>
            <div><strong>Incident ID:</strong> <span style={{ color: 'var(--accent-blue)', fontWeight: '700' }}>{lookupResult.id}</span></div>
            <div><strong>Status:</strong> <span className="badge badge-blue" style={{ marginLeft: '0.5rem' }}>{lookupResult.status}</span></div>
            <div><strong>Emergency Type:</strong> <span style={{ marginLeft: '0.5rem' }}>{lookupResult.emergencyType}</span></div>
            <div><strong>Assigned Ambulance:</strong> <span style={{ marginLeft: '0.5rem' }}>{lookupResult.assignedAmbulanceId || 'Dispatching nearest available unit...'}</span></div>
            <div><strong>Destination Hospital:</strong> <span style={{ marginLeft: '0.5rem' }}>{lookupResult.destinationHospitalId || 'Determining ER capability...'}</span></div>
          </div>
        )}
      </div>
    </div>
  );
};
