import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Shield, LogOut, LayoutDashboard, FilePlus,
  ClipboardCheck, ScrollText, Settings, User
} from 'lucide-react'
import useAuthStore from '../../store/authStore'

export default function Layout({ children }) {
  const { user={}, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const userNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'My Requests' },
    { to: '/request/new', icon: FilePlus, label: 'New Request' },
  ]
  const approverNav = [
    { to: '/approver', icon: ClipboardCheck, label: 'Pending Queue' },
    { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  ]
  const adminNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'My Requests' },
    { to: '/request/new', icon: FilePlus, label: 'New Request' },
    { to: '/approver', icon: ClipboardCheck, label: 'Approver Queue' },
    { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  ]

  const navItems =
    user?.role === 'admin' ? adminNav :
    user?.role === 'approver' ? approverNav :
    userNav

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        {/* Brand */}
        <div style={styles.brand}>
          <Shield size={20} color="var(--accent)" />
          <span style={styles.brandText}>SecureDesk</span>
        </div>

        {/* User chip */}
        <div style={styles.userChip}>
          <div style={styles.userAvatar}>
            {user?.full_name?.[0] ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.userName}>{user?.full_name}</div>
            <div style={styles.userRole} className="mono">{user?.role}</div>
          </div>
        </div>

        <hr style={styles.divider} />

        {/* Nav */}
        <nav style={styles.nav}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to !== '/approver'}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={handleLogout} className="btn-ghost" style={styles.logoutBtn}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '4px 8px 16px',
  },
  brandText: { fontSize: '16px', fontWeight: '600', color: 'var(--text)', letterSpacing: '-0.01em' },
  userChip: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 8px',
    background: 'var(--bg3)',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    marginBottom: '4px',
  },
  userAvatar: {
    width: '30px', height: '30px',
    background: 'rgba(0,212,255,0.12)',
    border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '600', color: 'var(--accent)',
    flexShrink: 0,
  },
  userName: { fontSize: '12px', fontWeight: '500', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: '10px', color: 'var(--text3)', marginTop: '1px' },
  divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' },
  nav: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '9px',
    padding: '8px 10px',
    borderRadius: '6px',
    color: 'var(--text2)',
    textDecoration: 'none',
    fontSize: '13px',
    transition: 'all 0.12s',
  },
  navItemActive: {
    background: 'rgba(0,212,255,0.08)',
    color: 'var(--accent)',
    border: '1px solid rgba(0,212,255,0.12)',
  },
  sidebarFooter: { marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' },
  logoutBtn: { width: '100%', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  main: { flex: 1, overflow: 'auto', background: 'var(--bg)' },
}
