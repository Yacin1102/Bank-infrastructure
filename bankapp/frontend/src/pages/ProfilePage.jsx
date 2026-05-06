import { useState, useEffect } from 'react';
import { userAPI, authAPI } from '../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ROLE_C = { admin: 'var(--purple)', agent: 'var(--amber)', client: 'var(--blue2)' };
const ROLE_L = { admin: 'Administrateur', agent: 'Agent', client: 'Client' };
const ST_C   = { active: 'var(--green)', suspended: 'var(--red)', pending: 'var(--amber)', closed: 'var(--t3)' };

export default function ProfilePage() {
  const [tab,      setTab]      = useState('profile');
  const [profile,  setProfile]  = useState(null);
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({});
  const [pwd,      setPwd]      = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPwd,setSavingPwd]= useState(false);

  useEffect(() => {
    Promise.all([userAPI.getProfile(), userAPI.getNotifications({ limit: 30 })])
      .then(([p, n]) => {
        setProfile(p.data.data.user);
        setForm(p.data.data.user);
        setNotifs(n.data.data || []);
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userAPI.updateProfile({ first_name: form.first_name, last_name: form.last_name, phone: form.phone, address: form.address, city: form.city, postal_code: form.postal_code });
      setProfile(res.data.data.user);
      setEditing(false);
      toast.success('Profil mis à jour !');
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setSavingPwd(true);
    try {
      await authAPI.changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      toast.success('Mot de passe modifié. Reconnectez-vous.');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    finally { setSavingPwd(false); }
  };

  const markRead = async (id) => {
    await userAPI.markRead(id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const markAll = async () => {
    await userAPI.markAllRead();
    setNotifs(n => n.map(x => ({ ...x, read: true })));
    toast.success('Toutes les notifications lues');
  };

  if (loading) return <div className="center-loader"><div className="spinner" /></div>;

  const initials = ((profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '')).toUpperCase();
  const unread   = notifs.filter(n => !n.read).length;

  const pwdChecks = [
    ['≥ 8 caractères',  pwd.newPassword.length >= 8],
    ['Majuscule',        /[A-Z]/.test(pwd.newPassword)],
    ['Minuscule',        /[a-z]/.test(pwd.newPassword)],
    ['Chiffre',          /\d/.test(pwd.newPassword)],
    ['Symbole (@$!%*?&)',/[@$!%*?&]/.test(pwd.newPassword)],
  ];

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>Mon Profil</h1>

        {/* En-tête profil */}
        <div className="card" style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,var(--blue),var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800,
          }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{profile?.first_name} {profile?.last_name}</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>{profile?.email}</div>
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <span className="badge" style={{ background: `${ROLE_C[profile?.role]}18`, color: ROLE_C[profile?.role] }}>
                {ROLE_L[profile?.role]}
              </span>
              <span className="badge" style={{ background: `${ST_C[profile?.status]}18`, color: ST_C[profile?.status] }}>
                {profile?.status}
              </span>
              {profile?.kyc_verified
                ? <span className="badge badge-green">✓ KYC</span>
                : <span className="badge badge-amber">KYC requis</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--t3)' }}>
            <div>Inscrit le</div>
            <div style={{ color: 'var(--t2)', marginTop: 2 }}>{profile?.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy') : '—'}</div>
            {profile?.last_login && (
              <>
                <div style={{ marginTop: 8 }}>Dernière connexion</div>
                <div style={{ color: 'var(--t2)', marginTop: 2 }}>{format(new Date(profile.last_login), 'dd/MM/yy HH:mm')}</div>
              </>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="tabs" style={{ marginTop: 24, marginBottom: 0 }}>
          {[
            { id: 'profile',       label: '👤 Informations' },
            { id: 'security',      label: '🔒 Sécurité' },
            { id: 'notifications', label: `🔔 Notifications${unread > 0 ? ` (${unread})` : ''}` },
          ].map(t => (
            <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {/* Onglet Informations */}
        {tab === 'profile' && (
          <div className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
              <h3 style={{ fontWeight: 700 }}>Informations personnelles</h3>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✏️ Modifier</button>}
            </div>

            {editing ? (
              <form onSubmit={handleSave}>
                <div className="grid-2">
                  {[['first_name','Prénom'],['last_name','Nom']].map(([k,l]) => (
                    <div key={k} className="form-group">
                      <label className="label">{l}</label>
                      <input className="input" value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} required />
                    </div>
                  ))}
                </div>
                {[['phone','Téléphone'],['address','Adresse'],['city','Ville'],['postal_code','Code postal']].map(([k,l]) => (
                  <div key={k} className="form-group">
                    <label className="label">{l}</label>
                    <input className="input" value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />
                  </div>
                ))}
                <div className="flex gap-3">
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setForm(profile); }}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sauvegarde…' : 'Enregistrer'}</button>
                </div>
              </form>
            ) : (
              <div className="grid-2" style={{ gap: 24 }}>
                {[
                  ['Prénom',         profile?.first_name],
                  ['Nom',            profile?.last_name],
                  ['Email',          profile?.email],
                  ['Téléphone',      profile?.phone],
                  ['CIN',            profile?.national_id],
                  ['Date naissance', profile?.date_of_birth ? format(new Date(profile.date_of_birth), 'dd/MM/yyyy') : null],
                  ['Adresse',        profile?.address],
                  ['Ville',          profile?.city],
                  ['Code postal',    profile?.postal_code],
                  ['Pays',           profile?.country],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
                    <div style={{ color: val ? 'var(--t1)' : 'var(--t3)', fontStyle: val ? 'normal' : 'italic' }}>
                      {val || 'Non renseigné'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Onglet Sécurité */}
        {tab === 'security' && (
          <div className="card" style={{ maxWidth: 460 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 24 }}>Changer le mot de passe</h3>
            <form onSubmit={handlePwd}>
              {[
                ['currentPassword','Mot de passe actuel','current-password'],
                ['newPassword',    'Nouveau mot de passe','new-password'],
                ['confirm',        'Confirmer le nouveau','new-password'],
              ].map(([k, l, ac]) => (
                <div key={k} className="form-group">
                  <label className="label">{l}</label>
                  <input type="password" className="input" autoComplete={ac}
                    value={pwd[k]} onChange={e => setPwd({ ...pwd, [k]: e.target.value })} required />
                </div>
              ))}

              {/* Indicateur force */}
              <div style={{ padding: 12, background: 'rgba(59,111,212,.06)', borderRadius: 8, marginBottom: 20, fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Exigences :</div>
                {pwdChecks.map(([label, ok]) => (
                  <div key={label} style={{ color: ok ? 'var(--green)' : 'var(--t3)', marginBottom: 2 }}>
                    {ok ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingPwd}>
                {savingPwd ? 'Modification…' : 'Changer le mot de passe'}
              </button>
            </form>
          </div>
        )}

        {/* Onglet Notifications */}
        {tab === 'notifications' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700 }}>
                Notifications {unread > 0 && <span className="badge badge-blue" style={{ marginLeft: 8 }}>{unread}</span>}
              </span>
              {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Tout marquer lu</button>}
            </div>
            {notifs.length === 0 ? (
              <div className="empty"><h3>Aucune notification</h3></div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                style={{
                  padding: '14px 20px', borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'rgba(59,111,212,.04)',
                  cursor: n.read ? 'default' : 'pointer',
                }}
              >
                <div className="flex justify-between items-center" style={{ gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 14, marginBottom: 3 }}>
                      {!n.read && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', marginRight: 8, verticalAlign: 'middle' }} />}
                      {n.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t2)' }}>{n.message}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>
                    {format(new Date(n.created_at), 'dd/MM HH:mm')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
