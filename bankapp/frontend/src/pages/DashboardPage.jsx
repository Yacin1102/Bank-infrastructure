import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountAPI, transactionAPI } from '../utils/api';
import { useAuth } from '../App';
import { format } from 'date-fns';

const TYPE_LABEL = { checking: 'Compte Courant', savings: 'Livret Épargne', business: 'Business', investment: 'Investissement' };
const TYPE_COLOR = { checking: 'var(--blue)', savings: 'var(--green)', business: 'var(--amber)', investment: 'var(--purple)' };
const STATUS_CLS  = { completed: 'badge-green', pending: 'badge-amber', failed: 'badge-red', cancelled: 'badge-gray', reversed: 'badge-purple' };
const TX_LABEL    = { transfer: 'Virement', deposit: 'Dépôt', withdrawal: 'Retrait', payment: 'Paiement', fee: 'Frais', interest: 'Intérêts' };

const fmt = (n, cur = 'TND') =>
  parseFloat(n || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3 }) + ' ' + cur;

export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const accsRes = await accountAPI.getAll();
        const accs    = accsRes.data.data || [];
        setAccounts(accs);
        if (accs.length > 0) {
          const txRes = await transactionAPI.getHistory(accs[0].id, { limit: 8 });
          setRecentTx(txRes.data.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  if (loading) return <div className="center-loader"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>
              Bonjour, {user?.first_name} 👋
            </h1>
            <p style={{ color: 'var(--t2)', marginTop: 4, fontSize: 13 }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/transfer')}>
            ↔ Nouveau virement
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Patrimoine total */}
        <div className="card" style={{
          background: 'linear-gradient(135deg,#1a2e50 0%,#141c2e 60%)',
          marginBottom: 24, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -40, width: 200, height: 200,
            background: 'radial-gradient(circle,rgba(59,111,212,.2) 0%,transparent 70%)',
          }} />
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 8 }}>
            Patrimoine Total
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: -1.5 }}>
            {fmt(totalBalance)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 6 }}>
            {accounts.length} compte{accounts.length !== 1 ? 's' : ''} actif{accounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Comptes */}
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {accounts.map(acc => (
            <div
              key={acc.id}
              onClick={() => navigate(`/accounts/${acc.id}/transactions`)}
              style={{
                background: 'linear-gradient(135deg,#1a2640 0%,#141c2e 100%)',
                border: `1px solid ${TYPE_COLOR[acc.type]}33`,
                borderRadius: 'var(--r-lg)', padding: 24,
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                transition: 'transform .2s,box-shadow .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: TYPE_COLOR[acc.type] }} />
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t2)', marginBottom: 12 }}>
                {acc.nickname || TYPE_LABEL[acc.type]}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--mono)', color: TYPE_COLOR[acc.type], letterSpacing: -1 }}>
                {fmt(acc.balance, acc.currency)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 12, fontFamily: 'var(--mono)' }}>
                {acc.account_number}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <span className={`badge ${acc.status === 'active' ? 'badge-green' : acc.status === 'frozen' ? 'badge-blue' : 'badge-amber'}`}>
                  {acc.status}
                </span>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{acc.currency}</span>
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <h3>Aucun compte</h3>
              <p>Créez votre premier compte depuis la section Comptes</p>
              <button className="btn btn-primary mt-4" onClick={() => navigate('/accounts')}>
                Ouvrir un compte
              </button>
            </div>
          )}
        </div>

        {/* Dernières transactions */}
        {accounts.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex justify-between items-center" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700 }}>Dernières transactions</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/accounts/${accounts[0].id}/transactions`)}>
                Voir tout →
              </button>
            </div>
            {recentTx.length === 0 ? (
              <div className="empty"><p>Aucune transaction</p></div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Référence</th><th>Type</th><th>Description</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                      <th>Date</th><th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTx.map(tx => {
                      const dir = tx.to_account_id === accounts[0]?.id ? 'credit' : 'debit';
                      return (
                        <tr key={tx.id}>
                          <td className="mono text-dim" style={{ fontSize: 11 }}>{tx.reference}</td>
                          <td>{TX_LABEL[tx.type] || tx.type}</td>
                          <td style={{ color: 'var(--t2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={dir}>{parseFloat(tx.amount).toFixed(3)} {tx.currency}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--t2)' }}>
                            {format(new Date(tx.created_at), 'dd/MM HH:mm')}
                          </td>
                          <td><span className={`badge ${STATUS_CLS[tx.status] || 'badge-gray'}`}>{tx.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
