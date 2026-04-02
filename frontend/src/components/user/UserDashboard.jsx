import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus, RefreshCw, Key, XCircle } from 'lucide-react'
import { listRequests, checkoutSecret, revokeRequest } from '../../services/api'
import { StatusBadge, TimeAgo, TTLCountdown, Spinner } from '../shared/StatusBadge'
import useAuthStore from '../../store/authStore'
import CheckoutModal from './CheckoutModal'

export default function UserDashboard() {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkoutData, setCheckoutData] = useState(null)
  const [actionId, setActionId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listRequests()
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCheckout = async (id) => {
    setActionId(id)
    try {
      const data = await checkoutSecret(id)
      setCheckoutData(data)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Checkout failed')
    } finally {
      setActionId(null)
    }
  }

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this access token early?')) return
    setActionId(id)
    try {
      await revokeRequest(id)
      load()
    } finally {
      setActionId(null)
    }
  }

  const stats = {
    pending:  requests.filter(r => r.status === 'pending').length,
    active:   requests.filter(r => r.status === 'active').length,
    approved: requests.filter(r => r.status === 'approved').length,
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My Access Requests</h1>
          <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '3px' }}>
            Welcome back, {user?.full_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-ghost" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <Link to="/request/new">
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <FilePlus size={14} />
              New Request
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: 'Active Sessions', value: stats.active, color: 'var(--green)', dot: 'dot-green' },
          { label: 'Awaiting Approval', value: stats.pending, color: 'var(--amber)', dot: 'dot-amber' },
          { label: 'Ready to Checkout', value: stats.approved, color: 'var(--purple)', dot: 'dot-purple' },
          { label: 'Total Requests', value: requests.length, color: 'var(--text2)', dot: 'dot-gray' },
        ].map(({ label, value, color, dot }) => (
          <div key={label} style={styles.statCard}>
            <span className={`dot ${dot}`} style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '28px', fontWeight: '600', color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Request list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={styles.empty}>
            <Spinner size={24} />
            <span style={{ color: 'var(--text3)' }}>Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ color: 'var(--text3)', marginBottom: '12px' }}>No requests yet</div>
            <Link to="/request/new">
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <FilePlus size={13} /> Create your first request
              </button>
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>System / Resource</th>
                  <th>Status</th>
                  <th>TTL / Expiry</th>
                  <th>Requested</th>
                  <th>Approver</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className="fade-in">
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--text)' }}>{req.system_name}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                        {req.resource_path}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={req.status} />
                      {req.caller_verified && (
                        <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '3px' }}>
                          ✓ identity verified
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: '160px' }}>
                      {req.status === 'active' ? (
                        <TTLCountdown
                          expiresAt={req.expires_at}
                          onExpired={load}
                        />
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: '12px' }}>
                          {req.approved_ttl
                            ? `${Math.round(req.approved_ttl / 60)}min approved`
                            : `${Math.round(req.requested_ttl / 60)}min requested`}
                        </span>
                      )}
                    </td>
                    <td><TimeAgo date={req.created_at} /></td>
                    <td>
                      <span style={{ color: 'var(--text2)', fontSize: '12px' }}>
                        {req.approver_name || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {req.status === 'approved' && (
                          <button
                            className="btn-success"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px' }}
                            onClick={() => handleCheckout(req.id)}
                            disabled={actionId === req.id}
                          >
                            {actionId === req.id ? <Spinner size={12} /> : <Key size={12} />}
                            Checkout
                          </button>
                        )}
                        {req.status === 'active' && (
                          <button
                            className="btn-danger"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 12px' }}
                            onClick={() => handleRevoke(req.id)}
                            disabled={actionId === req.id}
                          >
                            {actionId === req.id ? <Spinner size={12} /> : <XCircle size={12} />}
                            Revoke
                          </button>
                        )}
                        {req.status === 'pending' && (
                          <span style={{ color: 'var(--text3)', fontSize: '12px', padding: '5px 0' }}>
                            Awaiting review
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span style={{ color: 'var(--red)', fontSize: '12px' }}>
                            {req.approver_notes || 'Rejected'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkoutData && (
        <CheckoutModal data={checkoutData} onClose={() => setCheckoutData(null)} />
      )}
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', maxWidth: '1100px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontSize: '20px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.02em' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' },
  statCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '48px',
    color: 'var(--text3)',
  },
}
