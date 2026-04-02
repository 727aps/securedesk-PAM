import React, { useState } from 'react'
import { X, Eye, EyeOff, Copy, Check, AlertTriangle } from 'lucide-react'
import { TTLCountdown } from '../shared/StatusBadge'

export default function CheckoutModal({ data, onClose }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async (text) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal} className="fade-in">
        <div style={styles.header}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--green)' }}>
              ✓ Secret Checked Out
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
              Your time-limited Vault token is ready
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.body}>
          {/* Warning */}
          <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Handle with care.</strong> This token grants read access to{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{data.secret_path}</code>.
              It cannot be recovered after closing this window.
            </div>
          </div>

          {/* Token */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Vault Token</label>
            <div style={styles.tokenRow}>
              <code style={{
                ...styles.tokenCode,
                filter: revealed ? 'none' : 'blur(5px)',
                userSelect: revealed ? 'text' : 'none',
              }}>
                {data.vault_token}
              </code>
              <button
                className="btn-ghost"
                style={{ padding: '6px 8px', flexShrink: 0 }}
                onClick={() => setRevealed(!revealed)}
              >
                {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                className="btn-ghost"
                style={{ padding: '6px 8px', flexShrink: 0 }}
                onClick={() => copy(data.vault_token)}
                disabled={!revealed}
              >
                {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
              </button>
            </div>
            {!revealed && (
              <div className="form-hint" style={{ color: 'var(--text3)' }}>Click the eye icon to reveal the token</div>
            )}
          </div>

          {/* Details */}
          <div style={styles.details}>
            <div style={styles.detailRow}>
              <span style={{ color: 'var(--text3)' }}>Secret path</span>
              <code className="mono" style={{ fontSize: '12px', color: 'var(--accent)' }}>{data.secret_path}</code>
            </div>
            <div style={styles.detailRow}>
              <span style={{ color: 'var(--text3)' }}>Time remaining</span>
              <div style={{ flex: 1, maxWidth: '220px' }}>
                <TTLCountdown expiresAt={data.expires_at} />
              </div>
            </div>
          </div>

          {/* Usage example */}
          <div style={{ marginTop: '16px' }}>
            <div className="form-label" style={{ marginBottom: '8px' }}>Usage example</div>
            <div style={styles.codeBlock}>
              <code className="mono" style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
{`# Read secret via Vault API
curl -H "X-Vault-Token: <your-token>" \\
  http://vault:8200/v1/secret/data/${data.secret_path}

# Or via hvac (Python)
import hvac
client = hvac.Client(url="http://vault:8200", token="<your-token>")
secret = client.secrets.kv.v2.read_secret_version(
    path="${data.secret_path}"
)["data"]["data"]`}
              </code>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
  },
  body: { padding: '20px 24px' },
  footer: {
    padding: '14px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  tokenRow: {
    display: 'flex', alignItems: 'center', gap: '4px',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '4px 4px 4px 10px',
  },
  tokenCode: {
    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px',
    color: 'var(--text2)', wordBreak: 'break-all',
    transition: 'filter 0.2s',
  },
  details: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  detailRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '12px' },
  codeBlock: {
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '14px',
  },
}
