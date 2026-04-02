import React, { useState, useEffect } from 'react'
import { ScrollText, RefreshCw, Filter } from 'lucide-react'
import { getAuditLog } from '../services/api'
import { TimeAgo, Spinner } from '../components/shared/StatusBadge'

const EVENT_COLORS = {
  REQUEST_CREATED:    { color: 'var(--text2)',   bg: 'var(--bg4)' },
  REQUEST_APPROVED:   { color: 'var(--green)',   bg: 'var(--green-bg)' },
  REQUEST_REJECTED:   { color: 'var(--red)',     bg: 'var(--red-bg)' },
  OTP_ISSUED:         { color: 'var(--accent)',  bg: 'rgba(0,212,255,0.08)' },
  OTP_VERIFIED:       { color: 'var(--accent)',  bg: 'rgba(0,212,255,0.08)' },
  OTP_FAILED:         { color: 'var(--red)',     bg: 'var(--red-bg)' },
  CALLER_VERIFIED:    { color: 'var(--green)',   bg: 'var(--green-bg)' },
  SECRET_CHECKED_OUT: { color: 'var(--amber)',   bg: 'var(--amber-bg)' },
  SECRET_REVOKED:     { color: 'var(--red)',     bg: 'var(--red-bg)' },
  SECRET_EXPIRED:     { color: 'var(--text3)',   bg: 'var(--bg4)' },
  MANUAL_REVOKE:      { color: 'var(--red)',     bg: 'var(--red-bg)' },
}

const EVENT_ICONS = {
  REQUEST_CREATED:    '📋',
  REQUEST_APPROVED:   '✅',
  REQUEST_REJECTED:   '❌',
  OTP_ISSUED:         '🔑',
  OTP_VERIFIED:       '✓',
  OTP_FAILED:         '⚠',
  CALLER_VERIFIED:    '🛡',
  SECRET_CHECKED_OUT: '🔓',
  SECRET_REVOKED:     '🔒',
  SECRET_EXPIRED:     '⏱',
  MANUAL_REVOKE:      '🚫',
}

export default function AuditLogPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAuditLog()
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filter
    ? events.filter(e =>
        e.event_type.toLowerCase().includes(filter.toLowerCase()) ||
        e.actor_name?.toLowerCase().includes(filter.toLowerCase())
      )
    : events

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ScrollText size={20} color="var(--accent)" />
          <div>
            <h1 style={styles.title}>Audit Log</h1>
            <p style={{ color: 'var(--text3)', fontSize: '13px', marginTop: '2px' }}>
              Immutable record of all privileged access events
            </p>
          </div>
        </div>
        <button className="btn-ghost" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <Filter size={13} color="var(--text3)" style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by event type or actor..."
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <span style={{ color: 'var(--text3)', fontSize: '12px' }}>
          {filtered.length} events
        </span>
      </div>

      {/* Timeline */}
      <div style={styles.timeline}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Spinner size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
            No audit events found
          </div>
        ) : (
          filtered.map((event, i) => {
            const style = EVENT_COLORS[event.event_type] || EVENT_COLORS.REQUEST_CREATED
            const icon = EVENT_ICONS[event.event_type] || '•'
            const isExp = expanded === event.id

            return (
              <div
                key={event.id}
                style={styles.event}
                onClick={() => setExpanded(isExp ? null : event.id)}
              >
                {/* Timeline line */}
                <div style={styles.timelineBar}>
                  <div style={{ ...styles.timelineDot, background: style.color }} />
                  {i < filtered.length - 1 && <div style={styles.timelineLine} />}
                </div>

                <div style={{ flex: 1, paddingBottom: '16px' }}>
                  <div style={styles.eventRow}>
                    <span style={{
                      ...styles.eventBadge,
                      color: style.color,
                      background: style.bg,
                    }}>
                      {event.event_type}
                    </span>
                    <span style={{ color: 'var(--text3)', fontSize: '11px', marginLeft: 'auto' }}>
                      <TimeAgo date={new Date(event.event_time)} />
                    </span>
                  </div>

                  <div style={styles.eventMeta}>
                    {event.actor_name && (
                      <span style={{ color: 'var(--text2)', fontSize: '12px' }}>
                        by <strong style={{ color: 'var(--text)' }}>{event.actor_name}</strong>
                      </span>
                    )}
                    {event.request_id && (
                      <span className="mono" style={{ color: 'var(--text3)', fontSize: '11px' }}>
                        req: {event.request_id.toString().slice(0, 8)}...
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExp && event.details && Object.keys(event.details).length > 0 && (
                    <div style={styles.eventDetails} className="fade-in">
                      {Object.entries(event.details).map(([k, v]) => (
                        <div key={k} style={styles.detailRow}>
                          <span style={{ color: 'var(--text3)', fontSize: '11px', minWidth: '80px' }}>{k}</span>
                          <span className="mono" style={{ fontSize: '11px', color: 'var(--text2)', wordBreak: 'break-all' }}>
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', maxWidth: '900px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
  timeline: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '20px 20px 4px',
  },
  event: {
    display: 'flex', gap: '14px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderRadius: '6px',
    padding: '4px 8px',
    margin: '-4px -8px',
  },
  timelineBar: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px' },
  timelineDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginBottom: '4px' },
  timelineLine: { width: '1px', flex: 1, background: 'var(--border)', minHeight: '16px' },
  eventRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  eventBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: '500',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  eventMeta: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '4px' },
  eventDetails: {
    marginTop: '8px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailRow: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
}
