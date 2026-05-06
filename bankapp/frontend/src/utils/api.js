import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL: BASE, timeout: 15_000 });

/* Attache le token à chaque requête */
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('accessToken');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

/* Rafraîchissement automatique sur 401 TOKEN_EXPIRED */
api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401
        && err.response?.data?.code === 'TOKEN_EXPIRED'
        && !orig._retry) {
      orig._retry = true;
      try {
        const rf = localStorage.getItem('refreshToken');
        const r  = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rf });
        const { accessToken, refreshToken } = r.data.data;
        localStorage.setItem('accessToken',  accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        orig.headers.Authorization = `Bearer ${accessToken}`;
        return api(orig);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register:       d  => api.post('/auth/register', d),
  login:          (email, password) => api.post('/auth/login', { email, password }),
  logout:         () => api.post('/auth/logout'),
  me:             () => api.get('/auth/me'),
  changePassword: d  => api.put('/auth/change-password', d),
};

export const accountAPI = {
  getAll:     ()   => api.get('/accounts'),
  get:        id   => api.get(`/accounts/${id}`),
  getSummary: id   => api.get(`/accounts/${id}/summary`),
  create:     d    => api.post('/accounts', d),
  getAllAdmin: p    => api.get('/accounts/all', { params: p }),
  setStatus:  (id, action) => api.put(`/accounts/${id}/status`, { action }),
};

export const transactionAPI = {
  getHistory:     (accountId, p) => api.get(`/accounts/${accountId}/transactions`, { params: p }),
  transfer:       d  => api.post('/transactions/transfer', d),
  deposit:        d  => api.post('/transactions/deposit', d),
  getReport:      p  => api.get('/transactions/report', { params: p }),
};

export const userAPI = {
  getProfile:    ()  => api.get('/users/profile'),
  updateProfile: d   => api.put('/users/profile', d),
  getNotifications: p => api.get('/users/notifications', { params: p }),
  markRead:     id   => api.put(`/users/notifications/${id}/read`),
  markAllRead:  ()   => api.put('/users/notifications/read-all'),
};

export const adminAPI = {
  getDashboard:    ()          => api.get('/admin/dashboard'),
  getUsers:        p           => api.get('/admin/users', { params: p }),
  updateUserStatus:(id, status)=> api.put(`/admin/users/${id}/status`, { status }),
  verifyKYC:       (id, verified)=> api.put(`/admin/users/${id}/kyc`, { verified }),
};

export default api;
