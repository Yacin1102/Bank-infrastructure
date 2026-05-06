import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { transactionAPI, accountAPI } from '../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TX_LABEL  = { transfer: 'Virement', deposit: 'Dépôt', withdrawal: 'Retrait', payment: 'Paiement', fee: 'Frais', interest: 'Intérêts', refund: 'Remboursement' };
const ST_CLS    = { completed: 'badge-green', pending: 'badge-amber', failed: 'badge-red', cancelled: 'badge-gray', reversed: 'badge-purple' };
const ST_LBL    = { completed: 'Complété', pending: 'En attente', failed: 'Échoué', cancelled: 'Annulé', reversed: 'Inversé' };

const fmt3 = n => parseFloat(n || 0).toFixed(3);

export default function TransactionsPage() {
  const { accountId } = useParams();
  const navigate      = useNavigate();

  const [account, setAccount] = useState(null);
  const [txList,  setTxList]  = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, hasNext: false, hasPrev: false });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({ type: '', status: '', startDate: '', endDate: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, txRes] = await Promise.all([
        accountAPI.get(accountId),
        transactionAPI.getHistory(accountId, {
          page, limit: 15,
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        }),
      ]);
      setAccount(accRes.data.data);
      setTxList(txRes.data.data || []);
      setPagination(txRes.data.pagination || {});
    } catch (err) {
      toast.error('Erreur de chargement');
      if (err.response?.status === 403) navigate('/accounts');
    } finally { setLoading(false); }
  }, [accountId, page, filters, navigate]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => { setFilters({ type: '', status: '', startDate: '', endDate: '' }); setPage(1); };
  const hasFilters   = Object.values(filters).some(v => v);

  const creditSum = txList.filter(t => t.to_account_id === accountId && t.status === 'completed').reduce((s, t) => s + parseFloat(t.amount), 0);
  const debitSum  = txList.filter(t => t.from_account_id === accountId && t.status === 'completed').reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/accounts')}>← Retour</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>Historique</h1>
            {account && (
              <p className="mono" style={{ color: 'var(--t2)', fontSize: 13, marginTop: 2 }}>
                {account.account_number} · Solde : <strong style={{ color: 'var(--green)' }}>{fmt3(account.balance)} {account.currency}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Mini stats */}
        {!loading && (
          <div className="grid-3" style={{ maxWidth: 560 }}>
            {[
              { label: 'Total crédits (page)', val: `+${fmt3(creditSum)} TND`, cls: 'text-green' },
              { label: 'Total débits (page)',  val: `-${fmt3(debitSum)} TND`,  cls: 'text-red'   },
              { label: 'Transactions totales', val: String(pagination.total || 0), cls: ''       },
            ].map(s => (
              <div key={s.label} className="card card-sm">
                <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                <div className={`mono font-bold ${s.cls}`} style={{ fontSize: 16 }}>{s.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="page-content">
        {/* Filtres */}
        <div className="card card-sm" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {[
              { label: 'Type',    key: 'type',    options: [['', 'Tous'], ...Object.entries(TX_LABEL)] },
              { label: 'Statut',  key: 'status',  options: [['', 'Tous'], ...Object.entries(ST_LBL)]   },
            ].map(f => (
              <div key={f.key} style={{ flex: '1 1 120px' }}>
                <label className="label">{f.label}</label>
                <select className="select" value={filters[f.key]} onChange={e => { setFilters(p => ({ ...p, [f.key]: e.target.value })); setPage(1); }}>
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
            <div style={{ flex: '1 1 140px' }}>
              <label className="label">Depuis</label>
              <input type="date" className="input" value={filters.startDate} onChange={e => { setFilters(p => ({ ...p, startDate: e.target.value })); setPage(1); }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label className="label">Jusqu'au</label>
              <input type="date" className="input" value={filters.endDate} onChange={e => { setFilters(p => ({ ...p, endDate: e.target.value })); setPage(1); }} />
            </div>
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ marginBottom: 2 }}>✕ Reset</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="center-loader"><div className="spinner" /></div>
          ) : txList.length === 0 ? (
            <div className="empty"><h3>Aucune transaction</h3><p>Aucun résultat pour ces filtres</p></div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Type</th><th>Description</th>
                      <th>Contrepartie</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                      <th style={{ textAlign: 'right' }}>Frais</th>
                      <th>Statut</th>
                      <th>Réf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txList.map(tx => {
                      const dir     = tx.to_account_id === accountId ? 'credit' : 'debit';
                      const counter = dir === 'credit' ? (tx.from_holder || tx.from_number) : (tx.to_holder || tx.to_number);
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>
                            {format(new Date(tx.created_at), 'dd/MM/yy')}<br />
                            <span style={{ color: 'var(--t3)' }}>{format(new Date(tx.created_at), 'HH:mm')}</span>
                          </td>
                          <td>{TX_LABEL[tx.type] || tx.type}</td>
                          <td style={{ color: 'var(--t2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description || '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--t2)' }}>{counter || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={dir}>{fmt3(tx.amount)} {tx.currency}</span>
                          </td>
                          <td className="mono text-dim" style={{ textAlign: 'right', fontSize: 12 }}>
                            {parseFloat(tx.fee) > 0 ? fmt3(tx.fee) : '—'}
                          </td>
                          <td><span className={`badge ${ST_CLS[tx.status] || 'badge-gray'}`}>{ST_LBL[tx.status] || tx.status}</span></td>
                          <td className="mono text-dim" style={{ fontSize: 10 }}>{tx.reference}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-between items-center" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>
                    Page {page}/{pagination.pages} — {pagination.total} transactions
                  </span>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                    <button className="btn btn-ghost btn-sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>Suivant →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
