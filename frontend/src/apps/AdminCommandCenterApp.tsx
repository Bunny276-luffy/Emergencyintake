import React, { useEffect, useState } from 'react';
import type { SystemHealthReport, SystemErrorRecord, AuditLogEntry, Ambulance, Hospital } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { ShieldAlert, Server, Activity, AlertOctagon, CheckCircle2, RefreshCw, FileText, Truck, Building2 } from 'lucide-react';

export const AdminCommandCenterApp: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [errors, setErrors] = useState<SystemErrorRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [fleet, setFleet] = useState<Ambulance[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [hReportRes, errListRes, auditListRes, sysStatsRes, fleetListRes, hospListRes] = await Promise.allSettled([
        api.getAdminHealth(),
        api.getAdminErrors(),
        api.getAdminAudit(),
        api.getAdminStats(),
        api.getAdminFleet(),
        api.getAdminHospitals(),
      ]);

      if (hReportRes.status === 'fulfilled') setHealth(hReportRes.value);
      if (errListRes.status === 'fulfilled') setErrors(errListRes.value);
      if (auditListRes.status === 'fulfilled') setAuditLogs(auditListRes.value);
      if (sysStatsRes.status === 'fulfilled') setStats(sysStatsRes.value);
      if (fleetListRes.status === 'fulfilled') setFleet(fleetListRes.value);
      if (hospListRes.status === 'fulfilled') setHospitals(hospListRes.value);

      // Check if all failed due to unreachable backend
      const allRejected = [hReportRes, errListRes, auditListRes, sysStatsRes, fleetListRes, hospListRes].every((r) => r.status === 'rejected');
      if (allRejected && hReportRes.status === 'rejected') {
        setApiError((hReportRes.reason as Error)?.message || 'Failed to fetch admin data');
      }
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    socketService.joinAdminRoom();

    const handleSystemError = (newError: SystemErrorRecord) => {
      setErrors((prev) => [newError, ...prev]);
    };

    const handleAuditEvent = (newAudit: AuditLogEntry) => {
      setAuditLogs((prev) => [newAudit, ...prev]);
    };

    socketService.on('SYSTEM_ERROR_LOGGED', handleSystemError);
    socketService.on('AUDIT_EVENT_LOGGED', handleAuditEvent);

    return () => {
      socketService.off('SYSTEM_ERROR_LOGGED', handleSystemError);
      socketService.off('AUDIT_EVENT_LOGGED', handleAuditEvent);
      socketService.leaveRoom('admin-room');
    };
  }, []);

  const handleResolveError = async (errorId: string) => {
    try {
      await api.resolveAdminError(errorId);
      setErrors((prev) =>
        prev.map((e) => (e.id === errorId ? { ...e, resolved: true, resolvedAt: new Date().toISOString() } : e))
      );
    } catch (err: any) {
      setApiError(err.message);
    }
  };

  return (
    <div className="app-view" style={{ padding: '1.5rem 1rem' }}>
      <div className="app-title-bar">
        <div className="app-title-info">
          <h1>
            <ShieldAlert style={{ color: 'var(--accent-amber)' }} size={28} /> Admin Command Center Monitoring
          </h1>
          <p>Global infrastructure health, central error streams & operational audit log governance</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchAdminData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Sync Admin Telemetry
        </button>
      </div>

      {apiError && (
        <div className="card" style={{ backgroundColor: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent-red)' }}><strong>Admin Diagnostics Error:</strong> {apiError}</div>
        </div>
      )}

      {/* Infrastructure Component Status Grid */}
      {health && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span>System Infrastructure Component Status</span>
            <span className={`badge badge-${health.overallStatus === 'HEALTHY' ? 'green' : 'amber'}`} style={{ padding: '0.35rem 0.75rem', fontWeight: '700' }}>
              OVERALL STATUS: {health.overallStatus}
            </span>
          </div>

          <div className="grid-3" style={{ gap: '1rem' }}>
            {Object.entries(health.components).map(([name, comp]) => (
              <div key={name} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ textTransform: 'capitalize', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{name}</strong>
                  <span className={`badge badge-${comp.status === 'HEALTHY' ? 'green' : comp.status === 'NOT_CONFIGURED' ? 'amber' : 'red'}`}>
                    {comp.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{comp.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Central Errors & Audit Trail Grid */}
      <div className="grid-2" style={{ marginBottom: '1.5rem', gap: '1.5rem' }}>
        {/* Real Central System Error Stream */}
        <div className="card" style={{ borderColor: errors.some((e) => !e.resolved) ? 'var(--accent-red)' : 'var(--border-color)' }}>
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertOctagon size={20} /> Central System Error Stream
            </span>
            <span className="badge badge-red">{errors.filter((e) => !e.resolved).length} Unresolved</span>
          </div>

          {errors.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
              <CheckCircle2 className="empty-state-icon" color="var(--accent-green)" />
              <div className="empty-state-title">Zero Active Errors</div>
              <div className="empty-state-desc">All platform operational components and backend microservices are healthy</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '420px', overflowY: 'auto' }}>
              {errors.map((err) => (
                <div
                  key={err.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: err.resolved ? 'var(--border-color)' : 'var(--accent-red)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="badge badge-red">[{err.severity}] {err.source}</span>
                    {err.resolved ? (
                      <span className="badge badge-green">RESOLVED</span>
                    ) : (
                      <button className="btn btn-secondary" onClick={() => handleResolveError(err.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: '700' }}>
                        Mark Resolved
                      </button>
                    )}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{err.message}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    ID: {err.id} | Service: {err.service} ({err.operation}) | {new Date(err.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Operational Audit Trail */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1.25rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText color="var(--accent-blue)" size={20} /> Platform Audit Trail Stream
            </span>
            <span className="badge badge-blue">{auditLogs.length} Logged Events</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
            {auditLogs.map((entry) => (
              <div key={entry.id} style={{ padding: '0.875rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong style={{ color: 'var(--accent-blue)' }}>{entry.who}</strong>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{entry.what}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                  Source: {entry.source} | Action: {entry.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet & Hospital Summaries */}
      <div className="grid-2" style={{ gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck color="var(--accent-blue)" size={20} /> Fleet Network Status
            </span>
            <span className="badge badge-blue">{fleet.length} Units</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {fleet.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div><strong>{a.vehicleNumber}</strong> ({a.driverName})</div>
                <span className={`badge badge-${a.status === 'AVAILABLE' ? 'green' : 'blue'}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 color="var(--accent-green)" size={20} /> Hospital Network Status
            </span>
            <span className="badge badge-green">{hospitals.length} Facilities</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {hospitals.map((h) => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div><strong>{h.name}</strong></div>
                <div>
                  <span className="badge badge-green">{h.capacity.availableEmergencyBeds} ER Beds</span>
                  <span className="badge badge-amber" style={{ marginLeft: '0.375rem' }}>{h.capacity.availableICUBeds} ICU Beds</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
