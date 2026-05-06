import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { authAPI } from './utils/api';

import Layout          from './components/Layout';
import LoginPage       from './pages/LoginPage';
import DashboardPage   from './pages/DashboardPage';
import AccountsPage    from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import TransferPage    from './pages/TransferPage';
import ProfilePage     from './pages/ProfilePage';
import AdminPage       from './pages/AdminPage';

/* ─────────────────── Auth Context ─────────────────── */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) { setLoading(false); return; }
    authAPI.me()
      .then(r  => setUser(r.data.data.user))
      .catch(() => { localStorage.clear(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await authAPI.login(email, password);
    const { user, accessToken, refreshToken } = r.data.data;
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthCtx.Provider>
  );
}

/* ─────────────────── Route guards ─────────────────── */
function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  );
}

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading)   return <Spinner />;
  if (!user)     return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

/* ─────────────────── App ─────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"                          element={<DashboardPage />} />
            <Route path="accounts"                           element={<AccountsPage />} />
            <Route path="accounts/:accountId/transactions"   element={<TransactionsPage />} />
            <Route path="transfer"                           element={<TransferPage />} />
            <Route path="profile"                            element={<ProfilePage />} />
            <Route path="admin" element={<PrivateRoute adminOnly><AdminPage /></PrivateRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
