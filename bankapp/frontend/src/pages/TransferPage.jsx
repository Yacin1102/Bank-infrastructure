import { useState, useEffect } from 'react';
import { accountAPI, transactionAPI } from '../utils/api';
import toast from 'react-hot-toast';

const TYPE_LBL = { checking: 'Courant', savings: 'Épargne', business: 'Business', investment: 'Investissement' };

export default function TransferPage() {
  const [accounts, setAccounts] = useState([]);
  const [form,     setForm]     = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
  const [loading,  setLoading]  = useState(false);
  const [lastTx,   setLastTx]   = useState(null);

  useEffect(() => {
    accountAPI.getAll().then(res => {
      const accs = res.data.data || [];
      setAccounts(accs);
      if (accs.length > 0) setForm(f => ({ ...f, fromAccountId: accs[0].id }));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!form.fromAccountId || !form.toAccountId) { toast.error('Sélectionnez les deux comptes'); return; }
    if (form.fromAccountId === form.toAccountId)  { toast.error('Comptes source et destination identiques'); return; }
    if (isNaN(amt) || amt <= 0) { toast.error('Montant invalide'); return; }

    setLoading(true);
    try {
      const res = await transactionAPI.transfer({ ...form, amount: amt });
      setLastTx(res.data.data);
      toast.success('Virement effectué avec succès !');
      // Rafraîchir les soldes
      const accsRes = await accountAPI.getAll();
      setAccounts(accsRes.data.data || []);
      setForm(f => ({ ...f, amount: '', description: '', toAccountId: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors du virement');
    } finally { setLoading(false); }
  };

  const fromAcc = accounts.find(a => a.id === form.fromAccountId);
  const amtNum  = parseFloat(form.amount);
  const fee     = (!isNaN(amtNum) && amtNum > 0) ? Math.min(amtNum * 0.005, 50) : 0;

  return (
    <>
      <div className="page-header">
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>Virement</h1>
        <p style={{ color: 'var(--t2)', marginTop: 4, fontSize: 13 }}>
          Transfert entre vos comptes ou vers un bénéficiaire
        </p>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: 540 }}>
          {/* Confirmation */}
          {lastTx && (
            <div style={{
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)',
              borderRadius: 'var(--r)', padding: 20, marginBottom: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, color: '#0a1a0e',
                }}>✓</div>
                <span style={{ fontWeight: 700, color: 'var(--green)' }}>Virement confirmé</span>
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--t2)' }}>
                Réf : <strong style={{ color: 'var(--t1)' }}>{lastTx.reference}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>
                Montant : <strong style={{ color: 'var(--t1)' }}>{parseFloat(lastTx.amount).toFixed(3)} {lastTx.currency}</strong>
                {parseFloat(lastTx.fee) > 0 && <span style={{ color: 'var(--amber)' }}> + {parseFloat(lastTx.fee).toFixed(3)} frais</span>}
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 24 }}>Détails du virement</h3>
            <form onSubmit={handleSubmit}>
              {/* Compte source */}
              <div className="form-group">
                <label className="label">Compte source</label>
                <select className="select" value={form.fromAccountId}
                  onChange={e => setForm({ ...form, fromAccountId: e.target.value })} required>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nickname || TYPE_LBL[a.type]} — {a.account_number} ({parseFloat(a.balance).toFixed(3)} {a.currency})
                    </option>
                  ))}
                </select>
                {fromAcc && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--t2)' }}>
                    Disponible : <span className="mono font-bold text-green">{parseFloat(fromAcc.balance).toFixed(3)} {fromAcc.currency}</span>
                  </div>
                )}
              </div>

              {/* Compte destination */}
              <div className="form-group">
                <label className="label">ID Compte destination (UUID)</label>
                <input className="input mono" value={form.toAccountId}
                  onChange={e => setForm({ ...form, toAccountId: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
                {/* Raccourcis vers ses propres autres comptes */}
                {accounts.filter(a => a.id !== form.fromAccountId).length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t3)' }}>
                    Mes autres comptes :
                    {accounts.filter(a => a.id !== form.fromAccountId).map(a => (
                      <button key={a.id} type="button"
                        onClick={() => setForm({ ...form, toAccountId: a.id })}
                        style={{
                          marginLeft: 6, padding: '2px 7px',
                          background: 'rgba(59,111,212,.15)', border: 'none',
                          borderRadius: 4, cursor: 'pointer',
                          color: 'var(--blue2)', fontSize: 11, fontFamily: 'var(--mono)',
                        }}>
                        {a.account_number}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Montant */}
              <div className="form-group">
                <label className="label">Montant (TND)</label>
                <input className="input mono" type="number" step="0.001" min="0.001"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.000" required style={{ fontSize: 20 }} />
                {fee > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--amber)' }}>
                    Frais estimés : <strong>{fee.toFixed(3)} TND</strong> (0.5%, max 50 TND)
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="label">Motif (optionnel)</label>
                <input className="input" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Motif du virement" maxLength={255} />
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? 'Traitement…' : 'Confirmer le virement'}
              </button>
            </form>
          </div>

          <div style={{
            marginTop: 14, padding: 14,
            background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)',
            borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)',
          }}>
            ℹ️ Virements entre vos propres comptes : <strong>gratuits</strong>.
            Virements vers des tiers : <strong>0.5%</strong> (max 50 TND).
          </div>
        </div>
      </div>
    </>
  );
}
