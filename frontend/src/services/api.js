import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pam_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pam_token')
      localStorage.removeItem('pam_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then((r) => r.data)

export const getMe = () =>
  api.get('/auth/me').then((r) => r.data)

export const googleLogin = (credential) =>
  api.post('/auth/google', { credential }).then((r) => r.data)

// ─── Requests ─────────────────────────────────────────────────────────────────
export const createRequest = (data) =>
  api.post('/requests', data).then((r) => r.data)

export const listRequests = (statusFilter) =>
  api.get('/requests', { params: statusFilter ? { status_filter: statusFilter } : {} })
     .then((r) => r.data)

export const getRequest = (id) =>
  api.get(`/requests/${id}`).then((r) => r.data)

export const issueOTP = (id) =>
  api.post(`/requests/${id}/otp`).then((r) => r.data)

export const verifyOTP = (id, otp_code) =>
  api.post(`/requests/${id}/verify-otp`, { otp_code }).then((r) => r.data)

export const approveRequest = (id, data) =>
  api.post(`/requests/${id}/approve`, data).then((r) => r.data)

export const rejectRequest = (id, notes) =>
  api.post(`/requests/${id}/reject`, { notes }).then((r) => r.data)

export const checkoutSecret = (id) =>
  api.post(`/requests/${id}/checkout`).then((r) => r.data)

export const revokeRequest = (id) =>
  api.post(`/requests/${id}/revoke`).then((r) => r.data)

export const getAuditLog = (requestId) =>
  api.get('/requests/admin/audit', { params: requestId ? { request_id: requestId } : {} })
     .then((r) => r.data)

export default api
