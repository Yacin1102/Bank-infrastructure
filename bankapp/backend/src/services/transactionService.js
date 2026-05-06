'use strict';
const { query, getClient } = require('../config/database');
const { generateTransactionRef, getPagination, paginatedResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

class TransactionService {
  /* ─────────────── VIREMENT ─────────────── */
  async transfer({ fromAccountId, toAccountId, amount, description }, userId, ip) {
    const amt    = parseFloat(amount);
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Verrouiller les deux comptes dans un ordre déterministe (évite deadlock)
      const lockIds = [fromAccountId, toAccountId].sort();
      await client.query('SELECT id FROM accounts WHERE id=ANY($1) FOR UPDATE', [lockIds]);

      // Compte source
      const { rows: srcRows } = await client.query('SELECT * FROM accounts WHERE id=$1', [fromAccountId]);
      if (!srcRows.length) throw { status: 404, message: 'Compte source introuvable', code: 'SRC_NOT_FOUND' };
      const src = srcRows[0];
      if (src.user_id !== userId) throw { status: 403, message: 'Ce compte ne vous appartient pas', code: 'FORBIDDEN' };
      if (src.status !== 'active') throw { status: 400, message: `Compte source ${src.status}`, code: 'SRC_NOT_ACTIVE' };

      // Compte destination
      const { rows: dstRows } = await client.query('SELECT * FROM accounts WHERE id=$1', [toAccountId]);
      if (!dstRows.length) throw { status: 404, message: 'Compte destination introuvable', code: 'DST_NOT_FOUND' };
      const dst = dstRows[0];
      if (['frozen', 'closed'].includes(dst.status))
        throw { status: 400, message: 'Compte destination inaccessible', code: 'DST_NOT_ACTIVE' };

      // Frais : 0% interne (même user), 0.5% externe max 50
      const sameUser = src.user_id === dst.user_id;
      const fee      = sameUser ? 0 : Math.min(amt * 0.005, 50);
      const totalOut = amt + fee;

      const available = parseFloat(src.balance) + parseFloat(src.credit_limit);
      if (totalOut > available)
        throw { status: 400, message: `Solde insuffisant (disponible: ${parseFloat(src.balance).toFixed(3)} TND)`, code: 'INSUFFICIENT_FUNDS' };

      const ref = generateTransactionRef();

      // Insérer transaction
      const { rows: txRows } = await client.query(
        `INSERT INTO transactions
           (reference,from_account_id,to_account_id,type,amount,currency,fee,description,status,initiated_by,ip_address)
         VALUES ($1,$2,$3,'transfer',$4,$5,$6,$7,'pending',$8,$9) RETURNING *`,
        [ref, fromAccountId, toAccountId, amt, src.currency, fee, description || null, userId, ip || null]
      );

      // Débiter / créditer
      await client.query('UPDATE accounts SET balance=balance-$1, updated_at=NOW() WHERE id=$2', [totalOut, fromAccountId]);
      await client.query('UPDATE accounts SET balance=balance+$1, updated_at=NOW() WHERE id=$2', [amt, toAccountId]);
      await client.query(`UPDATE transactions SET status='completed', completed_at=NOW() WHERE id=$1`, [txRows[0].id]);

      // Notifications
      await client.query(
        `INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'debit','Débit effectué',$2)`,
        [userId, `Débit de ${amt.toFixed(3)} ${src.currency} – Réf: ${ref}`]
      );
      if (!sameUser) {
        await client.query(
          `INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'credit','Virement reçu',$2)`,
          [dst.user_id, `Virement de ${amt.toFixed(3)} ${src.currency} – Réf: ${ref}`]
        );
      }

      await client.query('COMMIT');
      logger.info('Virement', { ref, amt, fee, from: fromAccountId, to: toAccountId });
      return { ...txRows[0], status: 'completed', fee };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ─────────────── DÉPÔT (agent/admin) ─────────────── */
  async deposit({ accountId, amount, description }, agentId) {
    const amt    = parseFloat(amount);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
      if (!rows.length) throw { status: 404, message: 'Compte introuvable', code: 'ACCOUNT_NOT_FOUND' };
      const acc = rows[0];
      if (acc.status !== 'active') throw { status: 400, message: 'Compte non actif', code: 'ACCOUNT_NOT_ACTIVE' };

      const ref = generateTransactionRef();
      const { rows: txRows } = await client.query(
        `INSERT INTO transactions
           (reference,to_account_id,type,amount,currency,description,status,initiated_by,completed_at)
         VALUES ($1,$2,'deposit',$3,$4,$5,'completed',$6,NOW()) RETURNING *`,
        [ref, accountId, amt, acc.currency, description || 'Dépôt guichet', agentId]
      );
      await client.query('UPDATE accounts SET balance=balance+$1, updated_at=NOW() WHERE id=$2', [amt, accountId]);
      await client.query(
        `INSERT INTO notifications (user_id,type,title,message) VALUES ($1,'credit','Dépôt reçu',$2)`,
        [acc.user_id, `Dépôt de ${amt.toFixed(3)} ${acc.currency} crédité.`]
      );
      await client.query('COMMIT');
      return txRows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ─────────────── HISTORIQUE ─────────────── */
  async getTransactions(accountId, userId, page, limit, filters = {}) {
    // Vérifier que le compte appartient à l'utilisateur
    const { rows: own } = await query('SELECT id FROM accounts WHERE id=$1 AND user_id=$2', [accountId, userId]);
    if (!own.length) throw { status: 403, message: 'Accès refusé à ce compte', code: 'FORBIDDEN' };

    const { offset } = getPagination(page, limit);
    let where  = '(t.from_account_id=$1 OR t.to_account_id=$1)';
    const params = [accountId];
    let n = 2;

    if (filters.type)      { where += ` AND t.type=$${n++}`;         params.push(filters.type); }
    if (filters.status)    { where += ` AND t.status=$${n++}`;       params.push(filters.status); }
    if (filters.startDate) { where += ` AND t.created_at>=$${n++}`;  params.push(filters.startDate); }
    if (filters.endDate)   { where += ` AND t.created_at<=$${n++}`;  params.push(filters.endDate); }

    const cnt  = await query(`SELECT COUNT(*) FROM transactions t WHERE ${where}`, params);
    const rows = await query(
      `SELECT t.*,
              fa.account_number AS from_number,
              ta.account_number AS to_number,
              (fu.first_name||' '||fu.last_name) AS from_holder,
              (tu.first_name||' '||tu.last_name) AS to_holder,
              CASE WHEN t.to_account_id=$1 THEN 'credit' ELSE 'debit' END AS direction
       FROM transactions t
       LEFT JOIN accounts fa ON t.from_account_id=fa.id
       LEFT JOIN accounts ta ON t.to_account_id=ta.id
       LEFT JOIN users fu ON fa.user_id=fu.id
       LEFT JOIN users tu ON ta.user_id=tu.id
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT $${n} OFFSET $${n + 1}`,
      [...params, parseInt(limit), offset]
    );
    return paginatedResponse(rows.rows, cnt.rows[0].count, page, limit);
  }

  /* ─────────────── RAPPORT (admin) ─────────────── */
  async getReport(startDate, endDate) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 3_600_000);
    const end   = endDate   || new Date();
    const [summary, daily] = await Promise.all([
      query(
        `SELECT type, status, currency,
                COUNT(*) AS count,
                SUM(amount) AS total_amount,
                SUM(fee) AS total_fees,
                AVG(amount) AS avg_amount,
                MAX(amount) AS max_amount
         FROM transactions
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY type, status, currency
         ORDER BY total_amount DESC NULLS LAST`,
        [start, end]
      ),
      query(
        `SELECT DATE(created_at) AS date,
                COUNT(*) AS transactions,
                SUM(amount) FILTER (WHERE status='completed') AS volume,
                SUM(fee)    FILTER (WHERE status='completed') AS fees
         FROM transactions
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [start, end]
      ),
    ]);
    return { summary: summary.rows, dailyVolume: daily.rows };
  }
}

module.exports = new TransactionService();
