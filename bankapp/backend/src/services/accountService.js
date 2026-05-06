'use strict';
const { query } = require('../config/database');
const { generateAccountNumber, generateIBAN, getPagination, paginatedResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

const TYPE_LIMIT = { checking: 2, savings: 3, business: 1, investment: 5 };

class AccountService {
  /* Tous les comptes d'un utilisateur */
  async getUserAccounts(userId) {
    const { rows } = await query(
      `SELECT a.*,
              COALESCE(SUM(t.amount) FILTER (WHERE t.to_account_id=a.id AND t.status='completed' AND t.created_at>=NOW()-INTERVAL '30 days'), 0) AS received_30d,
              COALESCE(SUM(t.amount) FILTER (WHERE t.from_account_id=a.id AND t.status='completed' AND t.created_at>=NOW()-INTERVAL '30 days'), 0) AS sent_30d
       FROM accounts a
       LEFT JOIN transactions t ON t.from_account_id=a.id OR t.to_account_id=a.id
       WHERE a.user_id=$1 AND a.status!='closed'
       GROUP BY a.id
       ORDER BY a.created_at ASC`,
      [userId]
    );
    return rows;
  }

  /* Un compte – isAdmin bypass du check user_id */
  async getAccount(accountId, userId, isAdmin = false) {
    const sql = isAdmin
      ? `SELECT a.*, u.first_name, u.last_name, u.email FROM accounts a JOIN users u ON a.user_id=u.id WHERE a.id=$1`
      : `SELECT a.*, u.first_name, u.last_name, u.email FROM accounts a JOIN users u ON a.user_id=u.id WHERE a.id=$1 AND a.user_id=$2`;
    const params = isAdmin ? [accountId] : [accountId, userId];
    const { rows } = await query(sql, params);
    if (!rows.length) throw { status: 404, message: 'Compte introuvable', code: 'ACCOUNT_NOT_FOUND' };
    return rows[0];
  }

  /* Résumé + historique 30j */
  async getAccountSummary(accountId, userId) {
    const account = await this.getAccount(accountId, userId);
    const { rows: daily } = await query(
      `SELECT DATE(created_at) AS date,
              SUM(amount) FILTER (WHERE to_account_id=$1 AND status='completed') AS credited,
              SUM(amount) FILTER (WHERE from_account_id=$1 AND status='completed') AS debited,
              COUNT(*) AS tx_count
       FROM transactions
       WHERE (from_account_id=$1 OR to_account_id=$1) AND created_at>=NOW()-INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [accountId]
    );
    const { rows: stats } = await query(
      `SELECT COUNT(*) FILTER (WHERE status='completed') AS total_tx,
              COALESCE(SUM(amount) FILTER (WHERE to_account_id=$1 AND status='completed'),0) AS total_received,
              COALESCE(SUM(amount) FILTER (WHERE from_account_id=$1 AND status='completed'),0) AS total_sent
       FROM transactions WHERE from_account_id=$1 OR to_account_id=$1`,
      [accountId]
    );
    return { account, stats: stats[0], dailyHistory: daily };
  }

  /* Créer un compte */
  async createAccount(userId, type, currency = 'TND', nickname = null) {
    const { rows: existing } = await query(
      `SELECT COUNT(*) FROM accounts WHERE user_id=$1 AND type=$2 AND status!='closed'`,
      [userId, type]
    );
    if (parseInt(existing[0].count) >= (TYPE_LIMIT[type] || 2))
      throw { status: 400, message: `Limite de comptes '${type}' atteinte`, code: 'ACCOUNT_LIMIT' };

    const num  = generateAccountNumber();
    const iban = generateIBAN(num);
    const { rows } = await query(
      `INSERT INTO accounts (account_number,user_id,type,currency,balance,iban,nickname,status)
       VALUES ($1,$2,$3,$4,0.000,$5,$6,'active') RETURNING *`,
      [num, userId, type, currency, iban, nickname || null]
    );

    await query(
      `INSERT INTO notifications (user_id,type,title,message)
       VALUES ($1,'account_created','Nouveau compte ouvert',$2)`,
      [userId, `Compte ${type} (${num}) créé avec succès.`]
    );

    logger.info('Compte créé', { userId, type, num });
    return rows[0];
  }

  /* Admin: geler / dégeler */
  async setAccountStatus(accountId, status, adminId) {
    const { rows } = await query(
      `UPDATE accounts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, accountId]
    );
    if (!rows.length) throw { status: 404, message: 'Compte introuvable', code: 'ACCOUNT_NOT_FOUND' };
    await query(
      `INSERT INTO audit_logs (user_id,action,entity_type,entity_id,success)
       VALUES ($1,$2,'account',$3,true)`,
      [adminId, `SET_ACCOUNT_${status.toUpperCase()}`, accountId]
    );
    return rows[0];
  }

  /* Admin: liste paginée */
  async getAllAccounts(page, limit, filters = {}) {
    const { offset } = getPagination(page, limit);
    let where = 'WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.status) { where += ` AND a.status=$${n++}`; params.push(filters.status); }
    if (filters.type)   { where += ` AND a.type=$${n++}`;   params.push(filters.type); }
    if (filters.userId) { where += ` AND a.user_id=$${n++}`; params.push(filters.userId); }

    const cnt  = await query(`SELECT COUNT(*) FROM accounts a ${where}`, params);
    const rows = await query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM accounts a JOIN users u ON a.user_id=u.id
       ${where} ORDER BY a.created_at DESC
       LIMIT $${n} OFFSET $${n + 1}`,
      [...params, parseInt(limit), offset]
    );
    return paginatedResponse(rows.rows, cnt.rows[0].count, page, limit);
  }
}

module.exports = new AccountService();
