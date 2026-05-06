import { useState, useEffect, useCallback } from 'react';
import { adminAPI, transactionAPI } from '../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const fmt3 = n => parseFloat(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3 });

const ROLE_C = { admin: 'var(--purple)', agent: 'var(--amber)', client: 'var(--blue2)' };
const ST_C   = { active: 'var(--green)', suspended: 'var(--red)', pending: 'var(--amber)', closed: 'var(--t3)' };
const ST_L   = { active: 'Actif', suspended: 'Suspendu', pending: 'En attente', closed: 'Fermé' };
const TX_ST  = { completed: 'badge-green', pending: 'badge-amber', failed: 'badge-red' };

export default function AdminPage() {
  const [tab,    setTab]    = useState('dashboard');
  const [stats,  setStats]  = useState(null);
  const [users,  setUsers]  = useState([]);
  const [report, setReport] = useState(null);
  const [loading,setLoading]= useState(true);
  const [uPag,   setUPag]   = useState({});
  const [uPage,  setUPage]  = useState(1);
  const [search, setSearch] = useState('');
  const [uFilters,setUF]    = useState({ status: '', role: '' });
  const [busy,   setBusy]   = useState(null); // userId en cours de mise à jour

  /* ─── Loaders ─── */
  const loadDash = useCallback(async () => {
    setLoading(true);
    try   { const r = await adminAPI.getDashboard(); setStats(r.data.data); }
    catch { toast.error('Erreur dashboard'); }
    finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.getUsers({
        page: uPage, limit: 15, search,
        ...Object.fromEntries(Object.entries(uFilters).filter(([,v]) => v)),
      });
      setUsers(r.data.data || []);
      setUPag(r.data.pagination || {});
    } catch { toast.error('Erreur utilisateurs'); }
    finally { setLoading(false); }
  }, [uPage, search, uFilters]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try   { const r = await transactionAPI.getReport(); setReport(r.data.data); }
    catch { toast.error('Erreur rapport'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'dashboard') loadDash();
    if (tab === 'users')     loadUsers();
    if (tab === 'report')    loadReport();
  }, [tab, loadDash, loadUsers, loadReport]);

  /* ─── Actions ─── */
  const toggleStatus = async (u) => {
    const ns = u.status === 'active' ? 'suspended' : 'active';
    setBusy(u.id);
    try {
      await adminAPI.updateUserStatus(u.id, ns);
      toast.success(`${ns === 'active' ? 'Activé' : 'Suspendu'}`);
      loadUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setBusy(null); }
  };

  const toggleKYC = async (u) => {
    setBusy(u.id);
    try {
      await adminAPI.verifyKYC(u.id, !u.kyc_verified);
      toast.success(u.kyc_verified ? 'KYC révoqué' : 'KYC validé ✓');
      loadUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setBusy(null); }
  };

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'users',     label: '👥 Utilisateurs' },
    { id: 'report',    label: '📈 Rapport' },
  ];

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>Panneau Administration</h1>
        <p style={{ color: 'var(--t2)', marginTop: 4, fontSize: 13 }}>Gestion globale de la plateforme</p>
        <div className="tabs" style={{ marginTop: 24, marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => { setTab(t.id); setUPage(1); }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          loading ? <div className="center-loader"><div className="spinner" /></div>
          : stats && <>
            <div className="grid-4" style={{ marginBottom: 24 }}>
              {[
                { label: 'Utilisateurs',   value: stats.users?.total,              sub: `${stats.users?.active} actifs`,              color: 'var(--blue)' },
                { label: 'Solde total',    value: `${fmt3(stats.accounts?.total_balance)} TND`, sub: `${stats.accounts?.total} comptes`, color: 'var(--green)' },
                { label: 'Volume 30j',     value: `${fmt3(stats.transactions?.total_volume)} TND`, sub: `${stats.transactions?.total} transactions`, color: 'var(--purple)' },
                { label: 'Revenus frais',  value: `${fmt3(stats.transactions?.total_fees)} TND`, sub: '30 derniers jours',                color: 'var(--amber)' },
              ].map(k => (
                <div key={k.label} className="card card-sm">
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 8 }}>{k.label}</div>
                  <div className="mono font-800" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Alertes */}
            <div className="grid-3" style={{ marginBottom: 24 }}>
              <div className="card card-sm" style={{ borderColor: 'rgba(245,158,11,.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>⚠ KYC en attente</div>
                <div className="mono font-800 text-xl">{stats.users?.pending || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Comptes à valider</div>
              </div>
              <div className="card card-sm" style={{ borderColor: 'rgba(239,68,68,.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✕ Transactions échouées</div>
                <div className="mono font-800 text-xl">{stats.transactions?.failed || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Sur 30 jours</div>
              </div>
              <div className="card card-sm" style={{ borderColor: 'rgba(34,197,94,.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✓ Transactions OK</div>
                <div className="mono font-800 text-xl">{stats.transactions?.completed || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Complétées</div>
              </div>
            </div>

            {/* Transactions récentes */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
                Dernières transactions (toutes)
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Réf.</th><th>Type</th><th>Montant</th><th>Initié par</th><th>Date</th><th>Statut</th></tr></thead>
                  <tbody>
                    {(stats.recentTransactions || []).map(tx => (
                      <tr key={tx.reference}>
                        <td className="mono text-dim" style={{ fontSize: 10 }}>{tx.reference}</td>
                        <td style={{ textTransform: 'capitalize' }}>{tx.type}</td>
                        <td className="mono font-bold">{fmt3(tx.amount)} <span className="text-dim" style={{ fontWeight: 400 }}>{tx.currency}</span></td>
                        <td style={{ fontSize: 13 }}>{tx.initiated_by_name || '—'}</td>
                        <td className="text-dim" style={{ fontSize: 12 }}>{format(new Date(tx.created_at), 'dd/MM/yy HH:mm')}</td>
                        <td><span className={`badge ${TX_ST[tx.status] || 'badge-gray'}`}>{tx.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            <div className="card card-sm" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label className="label">Rechercher</label>
                  <input className="input" value={search} onChange={e => { setSearch(e.target.value); setUPage(1); }} placeholder="Nom, email…" />
                </div>
                {[
                  { label: 'Statut', key: 'status', opts: [['','Tous'],['active','Actif'],['suspended','Suspendu'],['pending','En attente']] },
                  { label: 'Rôle',   key: 'role',   opts: [['','Tous'],['admin','Admin'],['agent','Agent'],['client','Client']] },
                ].map(f => (
                  <div key={f.key} style={{ flex: '1 1 120px' }}>
                    <label className="label">{f.label}</label>
                    <select className="select" value={uFilters[f.key]} onChange={e => { setUF(p => ({ ...p, [f.key]: e.target.value })); setUPage(1); }}>
                      {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={loadUsers} style={{ marginBottom: 2 }}>🔄</button>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div className="center-loader"><div className="spinner" /></div>
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th><th>KYC</th><th>Dernière connexion</th><th>Inscription</th><th>Actions</th></tr></thead>
                      <tbody>
                        {users.length === 0 && (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--t3)' }}>Aucun utilisateur</td></tr>
                        )}
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{u.email}</div>
                            </td>
                            <td>
                              <span className="badge" style={{ background: `${ROLE_C[u.role]}18`, color: ROLE_C[u.role] }}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <span className="badge" style={{ background: `${ST_C[u.status]}18`, color: ST_C[u.status] }}>
                                {ST_L[u.status]}
                              </span>
                            </td>
                            <td>
                              {u.kyc_verified
                                ? <span className="badge badge-green">✓ Vérifié</span>
                                : <span className="badge badge-amber">Non vérifié</span>}
                            </td>
                            <td className="text-dim" style={{ fontSize: 12 }}>
                              {u.last_login ? format(new Date(u.last_login), 'dd/MM/yy HH:mm') : 'Jamais'}
                            </td>
                            <td className="text-dim" style={{ fontSize: 12 }}>
                              {format(new Date(u.created_at), 'dd/MM/yyyy')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  className={`btn btn-sm ${u.kyc_verified ? 'btn-ghost' : 'btn-success'}`}
                                  disabled={busy === u.id}
                                  onClick={() => toggleKYC(u)}>
                                  {u.kyc_verified ? '✕ KYC' : '✓ KYC'}
                                </button>
                                {u.status !== 'closed' && (
                                  <button
                                    className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                    disabled={busy === u.id}
                                    onClick={() => toggleStatus(u)}>
                                    {u.status === 'active' ? 'Suspendre' : 'Activer'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {uPag.pages > 1 && (
                    <div className="flex justify-between items-center" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                      <span className="text-dim" style={{ fontSize: 13 }}>Page {uPage}/{uPag.pages} — {uPag.total} utilisateurs</span>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" disabled={!uPag.hasPrev} onClick={() => setUPage(p => p-1)}>← Précédent</button>
                        <button className="btn btn-ghost btn-sm" disabled={!uPag.hasNext} onClick={() => setUPage(p => p+1)}>Suivant →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── RAPPORT ── */}
        {tab === 'report' && (
          loading ? <div className="center-loader"><div className="spinner" /></div>
          : !report ? <div className="empty"><h3>Aucune donnée</h3></div>
          : <>
            <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Résumé par type (30 jours)</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Type</th><th>Statut</th><th>Devise</th><th style={{ textAlign:'right' }}>Nb</th><th style={{ textAlign:'right' }}>Volume</th><th style={{ textAlign:'right' }}>Frais</th><th style={{ textAlign:'right' }}>Moy.</th></tr></thead>
                  <tbody>
                    {(report.summary || []).map((r, i) => (
                      <tr key={i}>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.type}</td>
                        <td><span className={`badge ${TX_ST[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                        <td className="mono">{r.currency}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{r.count}</td>
                        <td className="mono font-bold text-blue" style={{ textAlign:'right' }}>{fmt3(r.total_amount)}</td>
                        <td className="mono" style={{ textAlign:'right', color:'var(--amber)' }}>{fmt3(r.total_fees)}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{fmt3(r.avg_amount)}</td>
                      </tr>
                    ))}
                    {(!report.summary || report.summary.length === 0) && (
                      <tr><td colSpan={7} style={{ textAlign:'center', padding:30, color:'var(--t3)' }}>Aucune donnée</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Volume journalier</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th style={{ textAlign:'right' }}>Transactions</th><th style={{ textAlign:'right' }}>Volume (TND)</th><th style={{ textAlign:'right' }}>Frais (TND)</th></tr></thead>
                  <tbody>
                    {[...(report.dailyVolume || [])].reverse().map((r, i) => (
                      <tr key={i}>
                        <td className="mono">{format(new Date(r.date), 'dd/MM/yyyy')}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{r.transactions}</td>
                        <td className="mono font-bold text-blue" style={{ textAlign:'right' }}>{fmt3(r.volume)}</td>
                        <td className="mono" style={{ textAlign:'right', color:'var(--amber)' }}>{fmt3(r.fees)}</td>
                      </tr>
                    ))}
                    {(!report.dailyVolume || report.dailyVolume.length === 0) && (
                      <tr><td colSpan={4} style={{ textAlign:'center', padding:30, color:'var(--t3)' }}>Aucune donnée</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
