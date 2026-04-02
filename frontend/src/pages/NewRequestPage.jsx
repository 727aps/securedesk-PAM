import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { createRequest } from '../services/api'

const PRESET_RESOURCES = [
  { label: 'Production DB credentials', system: 'Production Database', path: 'prod/database' },
  { label: 'Production API keys', system: 'API Gateway', path: 'prod/api-keys' },
  { label: 'Production SSH keys', system: 'Server Access', path: 'prod/ssh-keys' },
  { label: 'Staging DB credentials', system: 'Staging Database', path: 'staging/database' },
  { label: 'AWS credentials (infra)', system: 'AWS Infrastructure', path: 'infra/aws-credentials' },
  { label: 'Custom path...', system: '', path: '' },
]

const TTL_OPTIONS = [
  { label: '15 minutes', value: 900 },
  { label: '1 hour', value: 3600 },
  { label: '4 hours', value: 14400 },
  { label: '8 hours', value: 28800 },
  { label: '24 hours', value: 86400 },
]

export default function NewRequestPage() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState(0)
  const [form, setForm] = useState({
    system_name: PRESET_RESOURCES[0].system,
    resource_path: PRESET_RESOURCES[0].path,
    justification: '',
    requested_ttl: 3600,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const selectPreset = (i) => {
    setPreset(i)
    if (PRESET_RESOURCES[i].path) {
      setForm(f => ({
        ...f,
        system_name: PRESET_RESOURCES[i].system,
        resource_path: PRESET_RESOURCES[i].path,
      }))
    }
  }

  const handleSubmit = async (e) => {
  e.preventDefault()

  if (!form.system_name.trim()) {
    setError('System name is required')
    return
  }

  if (!form.resource_path.trim()) {
    setError('Resource path is required')
    return
  }

  if (!form.justification.trim()) {
    setError('Business justification is required')
    return
  }

  setLoading(true)
  setError(null)

  try {
    await createRequest({
      ...form,
      requested_ttl: Number(form.requested_ttl),
    })

    navigate('/dashboard')

  } catch (err) {
    console.error(err)
    setError(err.response?.data?.detail || 'Failed to submit request')
  } finally {
    setLoading(false)
  }
}
  return (
    <div style={styles.page}>
      <button
        className="btn-ghost"
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', padding: '6px 10px' }}
      >
        <ArrowLeft size={13} /> Back
      </button>

      <h1 style={styles.title}>Request Privileged Access</h1>
      <p style={{ color: 'var(--text3)', fontSize: '13px', margin: '4px 0 24px' }}>
        All requests are reviewed by a helpdesk approver and include identity verification.
      </p>

      <div style={styles.grid}>
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Resource presets */}
          <div className="card">
            <div style={styles.sectionTitle}>Select Resource</div>
            <div style={styles.presets}>
              {PRESET_RESOURCES.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectPreset(i)}
                  style={{
                    ...styles.presetBtn,
                    ...(preset === i ? styles.presetActive : {}),
                  }}
                >
                  <span className="mono" style={{ fontSize: '11px', color: preset === i ? 'var(--accent)' : 'var(--text3)' }}>
                    {p.path || 'custom'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text)', marginTop: '3px' }}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={styles.sectionTitle}>Request Details</div>

            <div className="form-group">
              <label className="form-label">System name</label>
              <input
                type="text"
                value={form.system_name}
                onChange={e => setForm(f => ({ ...f, system_name: e.target.value }))}
                placeholder="e.g. Production Database"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vault resource path</label>
              <div style={{ position: 'relative' }}>
                <span style={styles.pathPrefix} className="mono">secret/data/</span>
                <input
                  type="text"
                  value={form.resource_path}
                  onChange={e => setForm(f => ({ ...f, resource_path: e.target.value }))}
                  placeholder="prod/database"
                  style={{ paddingLeft: '104px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  required
                />
              </div>
              <div className="form-hint">The Vault KV v2 path to the secret you need access to</div>
            </div>

            <div className="form-group">
              <label className="form-label">Business justification</label>
              <textarea
                value={form.justification}
                onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                placeholder="Describe why you need this access, for how long, and what you'll do with it..."
                rows={4}
                required
              />
              <div className="form-hint">
                Be specific — vague justifications will be rejected. The approver will verify your identity before approving.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Requested access duration</label>
              <select
                value={form.requested_ttl}
                onChange={e => setForm(f => ({ ...f, requested_ttl: Number(e.target.value) }))}
              >
                {TTL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="form-hint">
                The approver may grant a shorter duration. Access auto-revokes when TTL expires.
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            {loading ? 'Submitting...' : <><Send size={14} /> Submit Request</>}
          </button>
        </form>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card">
            <div style={styles.sectionTitle}>What happens next</div>
            {[
              { n: '1', title: 'Request submitted', desc: 'Your request enters the helpdesk queue for review.' },
              { n: '2', title: 'Identity verification', desc: 'The approver will call you and verify your identity via OTP before approving.' },
              { n: '3', title: 'Approval & checkout', desc: 'Once approved, you check out a scoped, time-limited Vault token.' },
              { n: '4', title: 'Auto-revocation', desc: 'The token is automatically revoked when the TTL expires. You can also revoke it early.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={styles.step}>
                <div style={styles.stepNum}>{n}</div>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '2px' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: '1.5' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="alert alert-info" style={{ fontSize: '12px' }}>
            <div>
              <strong>Zero standing privileges.</strong> No secrets are accessible without an approved, verified request.
              Every action is audit-logged.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', maxWidth: '960px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' },
  sectionTitle: { fontSize: '12px', fontWeight: '500', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' },
  presets: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  presetBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    padding: '10px 12px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'left',
  },
  presetActive: {
    background: 'rgba(0,212,255,0.06)',
    borderColor: 'rgba(0,212,255,0.3)',
  },
  pathPrefix: {
    position: 'absolute', top: '50%', left: '10px',
    transform: 'translateY(-50%)',
    fontSize: '11px', color: 'var(--text3)',
    pointerEvents: 'none',
  },
  step: { display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'flex-start' },
  stepNum: {
    width: '22px', height: '22px',
    background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', color: 'var(--accent)', fontWeight: '600',
    flexShrink: 0,
  },
}
