import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, User } from 'lucide-react'
import useAuthStore from '../store/authStore'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, googleLogin, loading, error } = useAuthStore()
  const navigate = useNavigate()
  const googleBtnRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const user = await login(username, password)
      navigate(user.role === 'user' ? '/dashboard' : '/approver')
    } catch {}
  }

  // Initialize Google Identity Services SDK
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const scriptId = 'google-gsi-script'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
    } else {
      initGoogle()
    }
  }, [])

  const initGoogle = () => {
    if (!window.google || !GOOGLE_CLIENT_ID || !googleBtnRef.current) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    })
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: 336,
      text: 'signin_with',
      shape: 'rectangular',
    })
  }

  const handleGoogleResponse = async (response) => {
    try {
      const user = await googleLogin(response.credential)
      navigate(user.role === 'user' ? '/dashboard' : '/approver')
    } catch {}
  }

  return (
    <div style={styles.root} className="scanline">
      {/* Grid background */}
      <div style={styles.grid} />

      <div style={styles.container} className="fade-in">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <Shield size={28} color="#00d4ff" />
          </div>
          <div>
            <div style={styles.logoTitle}>SecureDesk</div>
            <div style={styles.logoSub}>Privileged Access Management</div>
          </div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.terminalDots}>
              <span style={{ ...styles.dot, background: '#ff5f57' }} />
              <span style={{ ...styles.dot, background: '#febc2e' }} />
              <span style={{ ...styles.dot, background: '#28c840' }} />
            </div>
            <span style={styles.terminalTitle} className="mono">pam.auth.login</span>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={styles.inputWrap}>
                <User size={14} color="var(--text3)" style={styles.inputIcon} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alice"
                  style={{ paddingLeft: '34px' }}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={styles.inputWrap}>
                <Lock size={14} color="var(--text3)" style={styles.inputIcon} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: '34px' }}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-danger" style={{ fontSize: '12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '4px', padding: '11px' }}
            >
              {loading ? 'Authenticating...' : 'Authenticate'}
            </button>
          </form>

          {/* Google Sign-In */}
          {GOOGLE_CLIENT_ID && (
            <div style={styles.googleSection}>
              <div style={styles.dividerRow}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>or</span>
                <div style={styles.dividerLine} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div ref={googleBtnRef} />
              </div>
            </div>
          )}

          <hr className="divider" style={{ margin: '16px 0' }} />
          <div style={styles.demoHint}>
            <div style={{ color: 'var(--text3)', fontSize: '11px', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>// demo credentials</div>
            {[
              { user: 'alice', role: 'Regular user', color: 'var(--accent)' },
              { user: 'bob', role: 'Helpdesk approver', color: 'var(--green)' },
              { user: 'admin', role: 'Administrator', color: 'var(--amber)' },
            ].map(({ user, role, color }) => (
              <div
                key={user}
                style={styles.demoRow}
                onClick={() => { setUsername(user); setPassword('password123') }}
              >
                <span className="mono" style={{ color, fontSize: '12px' }}>{user}</span>
                <span style={{ color: 'var(--text3)', fontSize: '11px' }}>{role}</span>
                <span style={{ color: 'var(--text3)', fontSize: '11px', marginLeft: 'auto' }}>password123</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text3)', fontSize: '11px' }} className="mono">
          All access requests are logged and audited.
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  container: { width: '100%', maxWidth: '400px', padding: '0 20px', position: 'relative', zIndex: 1 },
  logo: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' },
  logoIcon: {
    width: '52px', height: '52px',
    background: 'rgba(0,212,255,0.08)',
    border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoTitle: { fontSize: '22px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.02em' },
  logoSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '1px' },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  cardHeader: {
    padding: '10px 16px',
    background: 'var(--bg3)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  terminalDots: { display: 'flex', gap: '6px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%', display: 'block' },
  terminalTitle: { fontSize: '11px', color: 'var(--text3)' },
  form: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', pointerEvents: 'none' },
  googleSection: { padding: '0 24px 16px' },
  dividerRow: { display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 14px' },
  dividerLine: { flex: 1, height: '1px', background: 'var(--border)' },
  dividerText: { color: 'var(--text3)', fontSize: '11px', fontFamily: 'var(--font-mono)' },
  demoHint: { padding: '0 24px 20px' },
  demoRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '7px 10px', borderRadius: '6px',
    cursor: 'pointer', transition: 'background 0.1s',
    marginBottom: '2px',
  },
}
