import React, { useState, useEffect } from 'react'
import { formatDistanceToNow, differenceInSeconds } from 'date-fns'

export function StatusBadge({ status }) {
  const dotClass = {
    pending:  'dot-amber',
    approved: 'dot-purple',
    active:   'dot-green',
    revoked:  'dot-red',
    expired:  'dot-gray',
    rejected: 'dot-red',
  }[status] || 'dot-gray'

  return (
    <span className={`badge badge-${status}`}>
      <span className={`dot ${dotClass}`} />
      {status}
    </span>
  )
}

export function TimeAgo({ date }) {
  if (!date) return <span className="text-dim">—</span>
  return (
    <span style={{ color: 'var(--text2)', fontSize: '12px' }}>
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </span>
  )
}

export function TTLCountdown({ expiresAt, onExpired }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const s = differenceInSeconds(new Date(expiresAt), new Date())
      setSecs(Math.max(0, s))
      if (s <= 0 && onExpired) onExpired()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt, onExpired])

  if (!expiresAt) return null

  const pct = Math.min(100, (secs / 3600) * 100)
  const color = secs < 300 ? 'var(--red)' : secs < 900 ? 'var(--amber)' : 'var(--green)'
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '4px', background: 'var(--bg4)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s linear, background 1s' }} />
      </div>
      <span className="mono" style={{ color, fontSize: '12px', minWidth: '60px' }}>
        {hh}:{mm}:{ss}
      </span>
    </div>
  )
}

export function OTPDisplay({ code, expiresAt }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const tick = () => setSecs(Math.max(0, differenceInSeconds(new Date(expiresAt), new Date())))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const pct = (secs / 300) * 100
  const expired = secs === 0

  return (
    <div style={{
      background: 'var(--bg3)',
      border: `2px solid ${expired ? 'rgba(255,82,82,0.3)' : 'rgba(0,212,255,0.3)'}`,
      borderRadius: '10px',
      padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', fontFamily: 'var(--font-mono)' }}>
        ONE-TIME VERIFICATION CODE
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '36px',
        fontWeight: '500',
        letterSpacing: '0.3em',
        color: expired ? 'var(--text3)' : 'var(--accent)',
        marginBottom: '14px',
      }}>
        {code}
      </div>
      <div style={{ height: '3px', background: 'var(--bg4)', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: secs < 60 ? 'var(--red)' : 'var(--accent)',
          transition: 'width 1s linear',
        }} />
      </div>
      <div style={{ fontSize: '11px', color: expired ? 'var(--red)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
        {expired ? 'EXPIRED — issue a new code' : `expires in ${secs}s`}
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />
      <div style={{ fontSize: '11px', color: 'var(--amber)', lineHeight: '1.5' }}>
        ⚠ Read this code to the caller verbally. Do NOT send via SMS, email, or chat.
      </div>
    </div>
  )
}

export function Spinner({ size = 16 }) {
  return (
    <div className="spinning" style={{
      width: size, height: size,
      border: `2px solid var(--border2)`,
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
    }} />
  )
}
