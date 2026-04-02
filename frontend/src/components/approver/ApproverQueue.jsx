import React, { useState, useEffect } from 'react'
import { RefreshCw, Phone, CheckCircle, XCircle, ShieldCheck, Clock } from 'lucide-react'
import {
  listRequests, issueOTP, verifyOTP,
  approveRequest, rejectRequest
} from '../../services/api'
import { StatusBadge, TimeAgo, Spinner } from '../shared/StatusBadge'

export default function ApproverQueue() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [activeOTP, setActiveOTP] = useState(null)  // { expires_at, message, email_sent }
  const [otpInput, setOtpInput] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [approveForm, setApproveForm] = useState({ approved_ttl: 3600, notes: '' })
  const [rejectNotes, setRejectNotes] = useState('')
  const [panel, setPanel] = useState('verify') // verify | approve | reject
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listRequests('pending')
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectRequest = (req) => {
    setSelected(req)
    setActiveOTP(null)
    setOtpInput('')
    setOtpVerified(req.caller_verified)
    setPanel('verify')
    setActionMsg(null)
  }

  const handleIssueOTP = async () => {
    setActionLoading(true)
    try {
      const data = await issueOTP(selected.id)
      setActiveOTP(data)
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.detail || 'Failed to issue OTP' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    setActionLoading(true)
    try {
      await verifyOTP(selected.id, otpInput)
      setOtpVerified(true)
      setPanel('approve')
      setActionMsg({ type: 'success', text: 'Identity verified. You can now approve or reject the request.' })
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.detail || 'OTP verification failed' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      await approveRequest(selected.id, approveForm)
      setActionMsg({ type: 'success', text: 'Request approved. The user can now check out their token.' })
      setTimeout(() => { setSelected(null); load() }, 1500)
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.detail || 'Approval failed' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNotes.trim()) { setActionMsg({ type: 'danger', text: 'Rejection reason is required' }); return }
    setActionLoading(true)
    try {
      await rejectRequest(selected.id, rejectNotes)
      setActionMsg({ type: 'success', text: 'Request rejected.' })
      setTimeout(() => { setSelected(null); load() }, 1200)
    } catch (err) {
      setActionMsg({ type: 'danger', text: err.response?.data?.detail || 'Rejection failed' })
    } finally {
      setActionLoading(false)
    }
  }

  const TTL_OPTS = [
    { label: '15 min', value: 900 },
    { label: '1 hour', value: 3600 },
    { label: '4 hours', value: 14400 },
    { label: '8 hours', value: 28800 },
  ]

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Helpdesk Approval Queue</h1>
          <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '3px' }}>
            Verify caller identity before approving access requests
          </p>
        </div>
        <button className="btn-ghost" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      <div style={styles.layout}>
        {/* Queue list */}
        <div style={styles.queue}>
          <div style={styles.queueHeader}>
            <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: '500' }}>PENDING REQUESTS</span>
            <span className="badge badge-pending">{requests.length}</span>
          </div>

          {loading ? (
            <div style={styles.queueEmpty}><Spinner /></div>
          ) : requests.length === 0 ? (
            <div style={styles.queueEmpty}>
              <CheckCircle size={24} color="var(--green)" />
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>Queue is clear</span>
            </div>
          ) : (
            requests.map(req => (
              <div
                key={req.id}
                style={{
                  ...styles.queueItem,
                  ...(selected?.id === req.id ? styles.queueItemActive : {}),
                }}
                onClick={() => selectRequest(req)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '500', fontSize: '13px' }}>{req.requester_name}</span>
                  <TimeAgo date={req.created_at} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>{req.system_name}</div>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text3)' }}>{req.resource_path}</div>
                {req.caller_verified && (
                  <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={10} /> identity verified
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div style={styles.detail}>
          {!selected ? (
            <div style={styles.noSelect}>
              <Phone size={28} color="var(--text3)" />
              <div style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '10px' }}>
                Select a request to begin verification
              </div>
            </div>
          ) : (
            <div className="fade-in">
              {/* Request info */}
              <div style={styles.reqInfo}>
                <div style={styles.reqInfoGrid}>
                  <div>
                    <div className="form-label">Requester</div>
                    <div style={{ fontWeight: '500', marginTop: '3px' }}>{selected.requester_name}</div>
                  </div>
                  <div>
                    <div className="form-label">System</div>
                    <div style={{ fontWeight: '500', marginTop: '3px' }}>{selected.system_name}</div>
                  </div>
                  <div>
                    <div className="form-label">Resource path</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '3px' }}>
                      secret/data/{selected.resource_path}
                    </div>
                  </div>
                  <div>
                    <div className="form-label">Requested TTL</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                      <Clock size={12} color="var(--text3)" />
                      {Math.round(selected.requested_ttl / 60)} minutes
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '14px' }}>
                  <div className="form-label" style={{ marginBottom: '6px' }}>Business justification</div>
                  <div style={styles.justification}>{selected.justification}</div>
                </div>
              </div>

              {/* Tab nav */}
              <div style={styles.tabs}>
                {[
                  { id: 'verify', label: 'Identity Verification', done: otpVerified },
                  { id: 'approve', label: 'Approve', disabled: !otpVerified },
                  { id: 'reject', label: 'Reject' },
                ].map(({ id, label, done, disabled }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => !disabled && setPanel(id)}
                    style={{
                      ...styles.tab,
                      ...(panel === id ? styles.tabActive : {}),
                      ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                      ...(id === 'reject' ? { color: panel === id ? 'var(--red)' : 'var(--text3)' } : {}),
                    }}
                  >
                    {done && id === 'verify' && <ShieldCheck size={12} color="var(--green)" />}
                    {label}
                  </button>
                ))}
              </div>

              {/* Panel: Verify */}
              {panel === 'verify' && (
                <div style={styles.panelBody}>
                  {otpVerified ? (
                    <div className="alert alert-success">
                      <ShieldCheck size={14} style={{ flexShrink: 0 }} />
                      Caller identity has been verified. Switch to the Approve tab to proceed.
                    </div>
                  ) : (
                    <>
                      <div className="alert alert-warning" style={{ marginBottom: '16px', fontSize: '12px' }}>
                        <div>
                          <strong>Anti-social-engineering step.</strong> Call the user on a known phone number.
                          Issue an OTP and ask them to read it back to you. Do NOT approve without verification.
                        </div>
                      </div>

                      {!activeOTP ? (
                        <button
                          className="btn-primary"
                          onClick={handleIssueOTP}
                          disabled={actionLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                        >
                          {actionLoading ? <Spinner size={13} /> : <Phone size={13} />}
                          Send OTP to user's email
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Email sent confirmation */}
                          <div style={{
                            background: 'var(--bg3)',
                            border: '1px solid rgba(0,212,255,0.25)',
                            borderRadius: '8px',
                            padding: '14px 16px',
                          }}>
                            <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: '6px', letterSpacing: '0.05em' }}>
                              OTP SENT VIA EMAIL
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: '1.5' }}>
                              {activeOTP.message}
                            </div>
                            {activeOTP.email_sent === false && (
                              <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '6px' }}>
                                ⚠ Email delivery failed — SMTP may not be configured.
                              </div>
                            )}
                          </div>

                          <div className="form-group">
                            <label className="form-label">Enter code the caller reads back</label>
                            <input
                              type="text"
                              value={otpInput}
                              onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit code"
                              className="mono"
                              style={{ fontSize: '18px', letterSpacing: '0.2em', textAlign: 'center' }}
                              maxLength={6}
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && otpInput.length === 6 && handleVerifyOTP()}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn-success"
                              onClick={handleVerifyOTP}
                              disabled={otpInput.length !== 6 || actionLoading}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                            >
                              {actionLoading ? <Spinner size={13} /> : <CheckCircle size={13} />}
                              Verify Identity
                            </button>
                            <button
                              className="btn-ghost"
                              onClick={handleIssueOTP}
                              disabled={actionLoading}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <RefreshCw size={12} /> Resend OTP
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Panel: Approve */}
              {panel === 'approve' && (
                <div style={styles.panelBody}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Grant access duration</label>
                    <div style={styles.ttlGrid}>
                      {TTL_OPTS.map(o => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setApproveForm(f => ({ ...f, approved_ttl: o.value }))}
                          style={{
                            ...styles.ttlBtn,
                            ...(approveForm.approved_ttl === o.value ? styles.ttlBtnActive : {}),
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <div className="form-hint">
                      User requested {Math.round(selected.requested_ttl / 60)} minutes.
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Approval notes (optional)</label>
                    <textarea
                      value={approveForm.notes}
                      onChange={e => setApproveForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Add any conditions or notes..."
                      rows={3}
                    />
                  </div>
                  <button
                    className="btn-success"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px' }}
                  >
                    {actionLoading ? <Spinner size={13} /> : <CheckCircle size={13} />}
                    Approve Request
                  </button>
                </div>
              )}

              {/* Panel: Reject */}
              {panel === 'reject' && (
                <div style={styles.panelBody}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Rejection reason (required)</label>
                    <textarea
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      placeholder="Explain why this request is being denied..."
                      rows={4}
                    />
                  </div>
                  <button
                    className="btn-danger"
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px' }}
                  >
                    {actionLoading ? <Spinner size={13} /> : <XCircle size={13} />}
                    Reject Request
                  </button>
                </div>
              )}

              {/* Action message */}
              {actionMsg && (
                <div style={{ padding: '0 20px 16px' }}>
                  <div className={`alert alert-${actionMsg.type}`}>{actionMsg.text}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em' },
  layout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', flex: 1, overflow: 'hidden' },
  queue: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  queueHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1,
  },
  queueItem: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  queueItemActive: { background: 'rgba(0,212,255,0.05)', borderLeft: '2px solid var(--accent)' },
  queueEmpty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '32px',
  },
  detail: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'auto',
  },
  noSelect: {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)',
  },
  reqInfo: {
    padding: '20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg3)',
  },
  reqInfoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  justification: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '13px',
    color: 'var(--text2)',
    lineHeight: '1.6',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    padding: '0 16px',
    gap: '2px',
  },
  tab: {
    background: 'transparent',
    color: 'var(--text3)',
    padding: '12px 14px',
    borderRadius: 0,
    borderBottom: '2px solid transparent',
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '13px',
    transition: 'all 0.12s',
    cursor: 'pointer',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
  },
  panelBody: { padding: '20px' },
  ttlGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' },
  ttlBtn: {
    padding: '8px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text2)',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  ttlBtnActive: {
    background: 'rgba(0,230,118,0.08)',
    borderColor: 'rgba(0,230,118,0.3)',
    color: 'var(--green)',
  },
}
