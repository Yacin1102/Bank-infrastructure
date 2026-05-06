import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

const IC = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  accounts:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4" strokeLinecap="round"/></svg>,
  transfer:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  admin:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  profile:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/></svg>,
  logout:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 16l4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

const ROLE_COLOR = { admin: 'var(--purple)', agent: 'var(--amber)', client: 'var(--blue2)' };
const ROLE_LABEL = { admin: 'Administrateur', agent: 'Agent', client: 'Client' };

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const initials = user
    ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '')
    : '?';

  const handleLogout = async () => {
    await logout();
    toast.success('Déconnecté');
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Bank<span>App</span></h1>
          <p>Plateforme Bancaire Sécurisée</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Principal</div>

          {[
            { to: '/dashboard', label: 'Tableau de bord', icon: IC.dashboard },
            { to: '/accounts',  label: 'Mes Comptes',     icon: IC.accounts  },
            { to: '/transfer',  label: 'Virement',        icon: IC.transfer  },
          ].map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {icon} {label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="nav-section">Administration</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {IC.admin} Panneau Admin
              </NavLink>
            </>
          )}

          <div className="nav-section">Compte</div>
          <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {IC.profile} Mon Profil
          </NavLink>
          <button className="nav-link danger" onClick={handleLogout}>
            {IC.logout} Déconnexion
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{initials.toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.first_name} {user?.last_name}</div>
              <div className="user-role" style={{ color: ROLE_COLOR[user?.role] }}>
                {ROLE_LABEL[user?.role]}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
