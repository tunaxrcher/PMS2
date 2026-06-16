import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Add token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  verifyPhone: (phone: string) => api.post('/auth/verify-phone', { phone }),
  login: (phone: string, pin: string) => api.post('/auth/login', { phone, pin }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePin: (currentPin: string, newPin: string, confirmPin: string) =>
    api.post('/auth/change-pin', { currentPin, newPin, confirmPin }),
}

export const bookingsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bookings', { params }),
  get: (id: string) => api.get(`/bookings/${id}`),
  create: (data: Record<string, unknown>) => api.post('/bookings', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/bookings/${id}`, data),
  cancel: (id: string, data: Record<string, unknown>) => api.post(`/bookings/${id}/cancel`, data),
  confirm: (id: string) => api.post(`/bookings/${id}/confirm`),
  noShow: (id: string, data: Record<string, unknown>) => api.post(`/bookings/${id}/no-show`, data),
  adjustRate: (id: string, data: Record<string, unknown>) => api.post(`/bookings/${id}/adjust-rate`, data),
  checkIn: (id: string) => api.post(`/bookings/${id}/check-in`),
  checkOut: (id: string) => api.post(`/bookings/${id}/check-out`),
  assignRoom: (id: string, data: Record<string, unknown>) => api.post(`/bookings/${id}/assign-room`, data),
  moveRoom: (id: string, data: Record<string, unknown>) => api.post(`/bookings/${id}/move-room`, data),
  sources: () => api.get('/bookings/sources'),
}

export const guestsApi = {
  list: (params?: Record<string, unknown>) => api.get('/guests', { params }),
  search: (q: string) => api.get('/guests/search', { params: { q } }),
  get: (id: string, sensitive?: boolean) => api.get(`/guests/${id}`, { params: { sensitive } }),
  create: (data: Record<string, unknown>) => api.post('/guests', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/guests/${id}`, data),
  bookings: (id: string) => api.get(`/guests/${id}/bookings`),
}

export const roomsApi = {
  list: (params?: Record<string, unknown>) => api.get('/rooms', { params }),
  get: (id: string) => api.get(`/rooms/${id}`),
  create: (data: Record<string, unknown>) => api.post('/rooms', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/rooms/${id}`, data),
  remove: (id: string) => api.delete(`/rooms/${id}`),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/rooms/${id}/status`, { status, reason }),
  grid: (from: string, to: string) => api.get('/rooms/grid', { params: { from, to } }),
  availability: (from: string, to: string) => api.get('/rooms/availability', { params: { from, to } }),
  getImages: (id: string) => api.get(`/rooms/${id}/images`),
  addImage: (id: string, data: { url: string; caption?: string; isPrimary?: boolean }) =>
    api.post(`/rooms/${id}/images`, data),
  deleteImage: (imageId: string) => api.delete(`/rooms/images/${imageId}`),
}

export const roomTypesApi = {
  list: () => api.get('/room-types'),
  create: (data: Record<string, unknown>) => api.post('/room-types', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/room-types/${id}`, data),
  remove: (id: string) => api.delete(`/room-types/${id}`),
}

export const zonesApi = {
  list: () => api.get('/zones'),
  flat: () => api.get('/zones/flat'),
  create: (data: Record<string, unknown>) => api.post('/zones', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/zones/${id}`, data),
  delete: (id: string) => api.delete(`/zones/${id}`),
}

export const foliosApi = {
  get: (id: string) => api.get(`/folios/${id}`),
  summary: (id: string) => api.get(`/folios/${id}/summary`),
  addCharge: (id: string, data: Record<string, unknown>) => api.post(`/folios/${id}/charges`, data),
  addDiscount: (id: string, data: Record<string, unknown>) => api.post(`/folios/${id}/discounts`, data),
  addPayment: (id: string, data: Record<string, unknown>) => api.post(`/folios/${id}/payments`, data),
  close: (id: string) => api.post(`/folios/${id}/close`),
  voidItem: (itemId: string) => api.patch(`/folios/items/${itemId}/void`),
}

export const paymentsApi = {
  void: (id: string, reason: string) => api.post(`/payments/${id}/void`, { reason }),
  refund: (id: string, amount: number, reason: string) =>
    api.post(`/payments/${id}/refund`, { amount, reason }),
}

export const depositsApi = {
  add: (bookingId: string, data: Record<string, unknown>) => api.post(`/deposits/booking/${bookingId}`, data),
  apply: (id: string) => api.post(`/deposits/${id}/apply`),
  refund: (id: string, reason: string) => api.post(`/deposits/${id}/refund`, { reason }),
}

export const housekeepingApi = {
  tasks: (params?: Record<string, unknown>) => api.get('/housekeeping/tasks', { params }),
  create: (data: Record<string, unknown>) => api.post('/housekeeping/tasks', data),
  start: (id: string) => api.post(`/housekeeping/tasks/${id}/start`),
  complete: (id: string, remark?: string) => api.post(`/housekeeping/tasks/${id}/complete`, { remark }),
  cancel: (id: string) => api.post(`/housekeeping/tasks/${id}/cancel`),
}

export const maintenanceApi = {
  list: (params?: Record<string, unknown>) => api.get('/maintenance', { params }),
  get: (id: string) => api.get(`/maintenance/${id}`),
  create: (data: Record<string, unknown>) => api.post('/maintenance', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/maintenance/${id}`, data),
  resolve: (id: string) => api.post(`/maintenance/${id}/resolve`),
}

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard'),
  dailyRevenue: (params?: Record<string, unknown>) => api.get('/reports/daily-revenue', { params }),
  occupancy: (date?: string) => api.get('/reports/occupancy', { params: { date } }),
  bookingSources: (from: string, to: string) => api.get('/reports/booking-sources', { params: { from, to } }),
  housekeeping: (date?: string) => api.get('/reports/housekeeping', { params: { date } }),
}

export const usersApi = {
  list: () => api.get('/users'),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
  resetPin: (id: string) => api.post(`/users/${id}/reset-pin`),
}

export const propertiesApi = {
  list: () => api.get('/properties'),
  get: (id: string) => api.get(`/properties/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/properties/${id}`, data),
}

export const ratePlansApi = {
  list: () => api.get('/rate-plans'),
  create: (data: Record<string, unknown>) => api.post('/rate-plans', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/rate-plans/${id}`, data),
  dailyRates: (params?: Record<string, unknown>) => api.get('/rate-plans/daily-rates', { params }),
  setDailyRate: (data: Record<string, unknown>) => api.post('/rate-plans/daily-rates', data),
}

export const auditLogsApi = {
  list: (params?: Record<string, unknown>) => api.get('/audit-logs', { params }),
  getActions: () => api.get('/audit-logs/actions'),
}
