import React, { useState } from 'react';
import { api } from '../services/api';
import { Activity, ShieldAlert, LogIn, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const LoginApp: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ username, password });
      onLoginSuccess(res.user, res.token);
      
      // Role based routing
      switch (res.user.role) {
        case 'DISPATCHER':
          navigate('/dispatch');
          break;
        case 'AMBULANCE_DRIVER':
          navigate('/ambulance');
          break;
        case 'PARAMEDIC':
          navigate('/paramedic');
          break;
        case 'HOSPITAL':
          navigate('/hospital');
          break;
        case 'ADMIN':
          navigate('/admin');
          break;
        default:
          navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <Activity size={32} color="var(--accent-red)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>Emergency AI Platform</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>Authorized Personnel Access Only</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)', padding: '0.875rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="var(--accent-red)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--accent-red)', fontWeight: '500' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="username" className="form-label">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. driver1, hospital1"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '0.5rem', width: '100%' }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} className="spin" /> Authenticating...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={18} /> Secure Login
              </span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <ShieldAlert size={14} /> National Emergency Operations Network
          </div>
        </div>
      </div>
    </div>
  );
};
