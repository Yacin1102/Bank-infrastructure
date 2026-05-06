import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountAPI } from '../utils/api';
import toast from 'react-hot-toast';

const TYPE_LABEL = { checking: 'Compte Courant', savings: 'Livret Épargne', business: 'Business', investment: 'Investissement' };
const TYPE_COLOR = { checking: 'var(--blue)', savings: 'var(--green)', business: 'var(--amber)', investment: 'var(--purple)' };
const TYPE_ICON  = { checking: '🏦', savings: '💰', business: '🏢', investment: '📈' };
const STATUS_CLS = { active: 'badge-green', frozen: 'badge-blue', pending: 'badge-amber', closed: 'badge-gray' };
const STATUS_LBL = { active: 'Actif', frozen: 'Gelé', pending: 'En attente', closed: 'Fermé' };

const fmt = (n, cur = 'TND') =>
  parseFloat(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3 }) + ' ' + cur;

export default function AccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form,     setForm]     = useState({ type: 'savings', currency: 'TND', nickname: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountAPI.getAll();
      setAccounts(res.data.data || []);
    } catch { toast.error('Impossible de charger les comptes'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountAPI.create(form);
      toast.success('Compte créé !');
      setModal(false);
      setForm({ type: 'savings', currency: 'TND', nickname: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur de création');
    } finally { setSaving(false); }
  };

  const total = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  if (loading) return <div className="center-loader"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>Mes Comptes</h1>
            <p style={{ color: 'var(--t2)', marginTop: 4, fontSize: 13 }}>
              {accounts.length} compte{accounts.length !== 1 ? 's' : ''} · Solde total :&nbsp;
              <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{fmt(total)}</strong>
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nouveau compte</button>
        </div>
      </div>

      <div className="page-content">
        {accounts.length === 0 ? (
          <div className="empty">
            <h3>Aucun compte</h3>
            <p>Ouvrez votre premier compte bancaire</p>
            <button className="btn btn-primary mt-4" onClick={() => setModal(true)}>Créer un compte</button>
          </div>
        ) : (
          <div className="grid-2">
            {accounts.map(acc => (
              <div key={acc.id} className="card" style={{ borderColor: `${TYPE_COLOR[acc.type]}33`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: TYPE_COLOR[acc.type] }} />

                <div className="flex justify-between items-center" style={{ marginBottom: 16, paddingTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 22 }}>{TYPE_ICON[acc.type]}</div>
                    <div style={{ fontWeight: 700, marginTop: 4 }}>{acc.nickname || TYPE_LABEL[acc.type]}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{TYPE_LABEL[acc.type]}</div>
                  </div>
                  <span className={`badge ${STATUS_CLS[acc.status]}`}>{STATUS_LBL[acc.status]}</span>
                </div>

                <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 800, color: TYPE_COLOR[acc.type], letterSpacing: -.5 }}>
                  {fmt(acc.balance, acc.currency)}
                </div>

                {parseFloat(acc.interest_rate) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>
                    Taux : {(parseFloat(acc.interest_rate) * 100).toFixed(2)}% / an
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>N° Compte</div>
                  <div className="mono" style={{ fontSize: 13, color: 'var(--t2)' }}>{acc.account_number}</div>
                  {acc.iban && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, marginBottom: 2 }}>IBAN</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--t2)', wordBreak: 'break-all' }}>{acc.iban}</div>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/accounts/${acc.id}/transactions`)}>
                    Historique
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => navigate('/transfer')}>
                    Virer
                  </button>
                </div>

                <div style={{ marginTop: 10, padding: '5px 8px', background: 'rgba(59,111,212,.06)', borderRadius: 5, fontSize: 10, color: 'var(--t3)' }}>
                  ID : <span className="mono">{acc.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal création */}
      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="card card-lg" style={{ width: '100%', maxWidth: 440 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ouvrir un compte</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="label">Type de compte</label>
                <select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{TYPE_ICON[v]} {l}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Devise</label>
                <select className="select" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option value="TND">TND – Dinar Tunisien</option>
                  <option value="EUR">EUR – Euro</option>
                  <option value="USD">USD – Dollar US</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Surnom (optionnel)</label>
                <input className="input" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} placeholder="ex : Épargne vacances" maxLength={100} />
              </div>
              <div style={{ padding: 12, background: 'rgba(59,111,212,.06)', borderRadius: 8, marginBottom: 20, fontSize: 12, color: 'var(--t2)' }}>
                {form.type === 'savings'    && '💰 Rémunéré à 3.5% / an — idéal pour épargner.'}
                {form.type === 'checking'   && '🏦 Compte quotidien pour vos opérations courantes.'}
                {form.type === 'business'   && '🏢 Dédié aux activités professionnelles.'}
                {form.type === 'investment' && '📈 Placement à long terme pour votre patrimoine.'}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? 'Création…' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
