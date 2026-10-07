import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { AmbulanceDriverApp } from './apps/AmbulanceDriverApp';
import { ParamedicTeamApp } from './apps/ParamedicTeamApp';
import { HospitalERApp } from './apps/HospitalERApp';
import { DispatchCenterApp } from './apps/DispatchCenterApp';
import { AdminCommandCenterApp } from './apps/AdminCommandCenterApp';
import { PublicSOSApp } from './apps/PublicSOSApp';
import { LoginApp } from './apps/LoginApp';
import { ThemeToggle } from './components/ThemeToggle';
import { socketService } from './services/socket';
import { api } from './services/api';
import { AlertCircle, Truck, Stethoscope, Building2, Radio, ShieldAlert, Wifi, WifiOff, ArrowLeft, ArrowRight, Activity, LogOut, User, Server, ShieldCheck } from 'lucide-react';

export const AuthContext = createContext<{
  user: any;
  token: string | null;
  login: (user: any, token: string) => void;
  logout: () => void;
}>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthGuard: React.FC<{ children: React.ReactNode; allowedRole?: string }> = ({ children, allowedRole }) => {
  const { user, token } = useAuth();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRole && user.role !== allowedRole) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view this workstation.</p>
        <Link to="/">Return to Gateway</Link>
      </div>
    );
  }
  
  return <>{children}</>;
};

const SystemStatusIndicator: React.FC<{ wsConnected: boolean; authStatus?: string }> = ({ wsConnected, authStatus }) => {
  const [apiOk, setApiOk] = useState(true);

  useEffect(() => {
    // Simple check
    const checkApi = async () => {
      try {
        await fetch('http://localhost:4000/api/health', { method: 'HEAD' });
        setApiOk(true);
      } catch (e) {
        setApiOk(false);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <span className={`badge badge-${wsConnected ? 'green' : 'red'}`} style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        {wsConnected ? 'WS CONNECTED' : 'WS DISCONNECTED'}
      </span>
      <span className={`badge badge-${apiOk ? 'green' : 'red'}`} style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        <Server size={10} />
        {apiOk ? 'API AVAILABLE' : 'API ERROR'}
      </span>
      {authStatus && (
        <span className="badge badge-purple" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <ShieldCheck size={10} />
          {authStatus}
        </span>
      )}
    </div>
  );
};

const LauncherPortal: React.FC<{ wsConnected: boolean }> = ({ wsConnected }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header with Theme Switcher in TOP-RIGHT corner */}
      <header className="portal-header">
        <div className="portal-brand">
          <Activity size={22} color="var(--accent-red)" />
          EMERGENCY AI <span className="portal-brand-badge">Command Platform</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <SystemStatusIndicator wsConnected={wsConnected} />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Gateway Portal View */}
      <div className="app-view" style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 1.5rem', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
            National Emergency Operations Gateway
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '640px', margin: '0 auto' }}>
            Select your assigned operational workstation to launch its isolated command interface
          </p>
        </div>

        <div className="grid-3" style={{ gap: '1.5rem' }}>
          {/* 1. Public SOS */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-red-bg)' }}>
                  <AlertCircle size={26} color="var(--accent-red)" />
                </div>
                <span className="badge badge-red">Citizen Access</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                Public SOS Emergency
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Instant emergency signal broadcast, geolocation capture, patient medical info, and status tracking.
              </p>
            </div>
            <Link to="/sos" className="btn btn-danger" style={{ width: '100%' }}>
              Launch Citizen Portal <ArrowRight size={16} />
            </Link>
          </div>

          {/* 2. Ambulance Driver */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-blue-bg)' }}>
                  <Truck size={26} color="var(--accent-blue)" />
                </div>
                <span className="badge badge-blue">Field Responder</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                Ambulance Driver
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Touch-optimized driver console, assignment telemetry, GPS location update & patient handoff workflow.
              </p>
            </div>
            <Link to="/ambulance" className="btn btn-primary" style={{ width: '100%' }}>
              Launch Driver Console <ArrowRight size={16} />
            </Link>
          </div>

          {/* 3. Paramedic Team */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-purple-bg)' }}>
                  <Stethoscope size={26} color="var(--accent-purple)" />
                </div>
                <span className="badge badge-purple">Clinical Care</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                Paramedic Team
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                On-scene clinical assessment, vital signs telemetry, triage classification & voice report structuring.
              </p>
            </div>
            <Link to="/paramedic" className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}>
              Launch Clinical Console <ArrowRight size={16} />
            </Link>
          </div>

          {/* 4. Hospital / ER */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-green-bg)' }}>
                  <Building2 size={26} color="var(--accent-green)" />
                </div>
                <span className="badge badge-green">Receiving ER</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                Hospital / ER Operations
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                ER capacity management, incoming patient bed reservations, and pre-arrival Accept/Reject decisions.
              </p>
            </div>
            <Link to="/hospital" className="btn btn-success" style={{ width: '100%' }}>
              Launch ER Dashboard <ArrowRight size={16} />
            </Link>
          </div>

          {/* 5. 108 Dispatch Center */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-red-bg)' }}>
                  <Radio size={26} color="var(--accent-red)" />
                </div>
                <span className="badge badge-red">Dispatch Control</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                108 Dispatch Command
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Emergency command console, PostGIS spatial fleet assignment, hospital candidate matching & rerouting.
              </p>
            </div>
            <Link to="/dispatch" className="btn btn-danger" style={{ width: '100%' }}>
              Launch Command Console <ArrowRight size={16} />
            </Link>
          </div>

          {/* 6. Admin Command Center */}
          <div className="card workstation-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="workstation-icon-wrapper" style={{ backgroundColor: 'var(--accent-amber-bg)' }}>
                  <ShieldAlert size={26} color="var(--accent-amber)" />
                </div>
                <span className="badge badge-amber">Global Audit</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                Admin Command Center
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Global platform diagnostics, real system error stream, audit governance, fleet & hospital monitoring.
              </p>
            </div>
            <Link to="/admin" className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--accent-amber)', color: 'var(--accent-amber)' }}>
              Launch Admin Console <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// Workstation Wrapper with isolated role header, return button, and theme toggle (NO cross-role links)
const WorkstationWrapper: React.FC<{
  children: React.ReactNode;
  appTitle: string;
  roleBadge: { label: string; color: 'red' | 'blue' | 'green' | 'purple' | 'amber' };
  wsConnected: boolean;
  publicAccess?: boolean;
}> = ({ children, appTitle, roleBadge, wsConnected, publicAccess = false }) => {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {publicAccess ? (
            <Link to="/" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: '600' }}>
              <ArrowLeft size={14} /> Gateway
            </Link>
          ) : (
            <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontWeight: '600' }}>
              <LogOut size={14} /> Logout
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
              {appTitle}
            </span>
            <span className={`badge badge-${roleBadge.color}`} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>
              {roleBadge.label}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
              <User size={14} />
              {user.username} ({user.ambulanceId || user.paramedicId || user.hospitalId || user.role})
            </div>
          )}
          
          <SystemStatusIndicator wsConnected={wsConnected} authStatus={user ? 'AUTHENTICATED' : undefined} />

          <ThemeToggle />
        </div>
      </header>

      <div style={{ flex: 1, padding: '1rem 0' }}>
        {children}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [wsConnected, setWsConnected] = useState(false);
  
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));

  const handleLogin = (newUser: any, newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    socketService.reconnect();
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    socketService.disconnect();
    window.location.href = '/login';
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      alert('Session expired or unauthorized. Please log in again.');
      handleLogout();
    };

    const handleForbidden = (e: any) => {
      alert('Access Denied: ' + (e.detail || 'You do not have permission to perform this action.'));
    };

    const handleRateLimit = (e: any) => {
      alert('Rate Limit Exceeded: ' + (e.detail || 'Please slow down your requests.'));
    };

    window.addEventListener('api:unauthorized', handleUnauthorized);
    window.addEventListener('api:forbidden', handleForbidden);
    window.addEventListener('api:ratelimit', handleRateLimit);

    return () => {
      window.removeEventListener('api:unauthorized', handleUnauthorized);
      window.removeEventListener('api:forbidden', handleForbidden);
      window.removeEventListener('api:ratelimit', handleRateLimit);
    };
  }, []);

  useEffect(() => {
    if (token) {
      const socket = socketService.connect();
      setWsConnected(socket.connected);

      const handleConnect = () => setWsConnected(true);
      const handleDisconnect = () => setWsConnected(false);

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    } else {
      setWsConnected(false);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login: handleLogin, logout: handleLogout }}>
      <BrowserRouter>
        <div className="app-container">
          <main className="app-view" style={{ padding: 0 }}>
            <Routes>
              <Route path="/" element={<LauncherPortal wsConnected={wsConnected} />} />
              <Route path="/login" element={<LoginApp onLoginSuccess={handleLogin} />} />
              <Route
                path="/sos"
                element={
                  <WorkstationWrapper
                    appTitle="Public SOS Emergency Portal"
                    roleBadge={{ label: 'Citizen Access', color: 'red' }}
                    wsConnected={wsConnected}
                    publicAccess={true}
                  >
                    <PublicSOSApp />
                  </WorkstationWrapper>
                }
              />
              <Route
                path="/ambulance"
                element={
                  <AuthGuard allowedRole="AMBULANCE_DRIVER">
                    <WorkstationWrapper
                      appTitle="Ambulance Driver Mobile Console"
                      roleBadge={{ label: 'Field Responder', color: 'blue' }}
                      wsConnected={wsConnected}
                    >
                      <AmbulanceDriverApp />
                    </WorkstationWrapper>
                  </AuthGuard>
                }
              />
              <Route
                path="/paramedic"
                element={
                  <AuthGuard allowedRole="PARAMEDIC">
                    <WorkstationWrapper
                      appTitle="Paramedic Clinical Workspace"
                      roleBadge={{ label: 'Clinical Care', color: 'purple' }}
                      wsConnected={wsConnected}
                    >
                      <ParamedicTeamApp />
                    </WorkstationWrapper>
                  </AuthGuard>
                }
              />
              <Route
                path="/hospital"
                element={
                  <AuthGuard allowedRole="HOSPITAL">
                    <WorkstationWrapper
                      appTitle="Hospital ER Receiving Dashboard"
                      roleBadge={{ label: 'Receiving ER', color: 'green' }}
                      wsConnected={wsConnected}
                    >
                      <HospitalERApp />
                    </WorkstationWrapper>
                  </AuthGuard>
                }
              />
              <Route
                path="/dispatch"
                element={
                  <AuthGuard allowedRole="DISPATCHER">
                    <WorkstationWrapper
                      appTitle="108 Dispatch Command Console"
                      roleBadge={{ label: 'Dispatch Control', color: 'red' }}
                      wsConnected={wsConnected}
                    >
                      <DispatchCenterApp />
                    </WorkstationWrapper>
                  </AuthGuard>
                }
              />
              <Route
                path="/admin"
                element={
                  <AuthGuard allowedRole="ADMIN">
                    <WorkstationWrapper
                      appTitle="Admin Command Center Monitoring"
                      roleBadge={{ label: 'Global Audit', color: 'amber' }}
                      wsConnected={wsConnected}
                    >
                      <AdminCommandCenterApp />
                    </WorkstationWrapper>
                  </AuthGuard>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

export default App;
