import { create } from 'zustand'
import { login as apiLogin, googleLogin as apiGoogleLogin } from '../services/api'

const useAuthStore = create((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('pam_user')) } catch { return null }
  })(),
  token: localStorage.getItem('pam_token') || null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const data = await apiLogin(username, password)
      localStorage.setItem('pam_token', data.access_token)
      localStorage.setItem('pam_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.access_token, loading: false })
      return data.user
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  googleLogin: async (credential) => {
    set({ loading: true, error: null })
    try {
      const data = await apiGoogleLogin(credential)
      localStorage.setItem('pam_token', data.access_token)
      localStorage.setItem('pam_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.access_token, loading: false })
      return data.user
    } catch (err) {
      const msg = err.response?.data?.detail || 'Google login failed'
      set({ error: msg, loading: false })
      throw new Error(msg)
    }
  },

  logout: () => {
    localStorage.removeItem('pam_token')
    localStorage.removeItem('pam_user')
    set({ user: null, token: null })
  },
}))

export default useAuthStore
