'use strict';
const { body }     = require('express-validator');
const { validate } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const { query }       = require('../config/database');
const { sanitizeUser, paginatedResponse, getPagination } = require('../utils/helpers');
const logger = require('../utils/logger');

/* ═══════════════════════════ PROFIL ═══════════════════════════ */

exports.getProfile = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.*,
              COUNT(DISTINCT a.id) FILTER (WHERE a.status!='closed') AS account_count,
              COUNT(DISTINCT n.id) FILTER (WHERE n.read=false) AS unread_notifications
       FROM users u
       LEFT JOIN accounts a ON a.user_id=u.id
       LEFT JOIN notifications n ON n.user_id=u.id
       WHERE u.id=$1
       GROUP BY u.id`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    res.json({ success: true, data: { user: sanitizeUser(rows[0]) } });
  } catch (e) { next(e); }
};

exports.updateProfile = [
  body('first_name').optional().trim().isLength({ min: 2, max: 100 }),
  body('last_name').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().isMobilePhone(),
  body('address').optional().isLength({ max: 500 }).trim(),
  body('city').optional().isLength({ max: 100 }).trim(),
  body('postal_code').optional().isLength({ max: 20 }).trim(),
  validate,
  async (req, res, next) => {
    try {
      const { first_name, last_name, phone, address, city, postal_code } = req.body;
      const { rows } = await query(
        `UPDATE users SET
           first_name=COALESCE($1,first_name),
           last_name=COALESCE($2,last_name),
           phone=COALESCE($3,phone),
           address=COALESCE($4,address),
           city=COALESCE($5,city),
           postal_code=COALESCE($6,postal_code),
           updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [first_name||null, last_name||null, phone||null, address||null, city||null, postal_code||null, req.user.id]
      );
      res.json({ success: true, message: 'Profil mis à jour', data: { user: sanitizeUser(rows[0]) } });
    } catch (e) { next(e); }
  },
];

/* ═══════════════════════ NOTIFICATIONS ════════════════════════ */

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const { offset } = getPagination(page, limit);
    const extra = unreadOnly === 'true' ? ' AND read=false' : '';
    const cnt  = await query(`SELECT COUNT(*) FROM notifications WHERE user_id=$1${extra}`, [req.user.id]);
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id=$1${extra} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );
    res.json({ success: true, ...paginatedResponse(rows.rows, cnt.rows[0].count, page, limit) });
  } catch (e) { next(e); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications SET read=true, read_at=NOW() WHERE id=$1 AND user_id=$2`,
      [req.params.notificationId, req.user.id]
    );
    res.json({ success: true, message: 'Notification lue' });
  } catch (e) { next(e); }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `UPDATE notifications SET read=true, read_at=NOW() WHERE user_id=$1 AND read=false`,
      [req.user.id]
    );
    res.json({ success: true, message: `${rowCount} notification(s) marquée(s) comme lues` });
  } catch (e) { next(e); }
};

/* ════════════════════════ ADMIN: USERS ════════════════════════ */

exports.getDashboardStats = [
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const [users, accounts, txStats, recentTx] = await Promise.all([
        query(`SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status='active')  AS active,
                 COUNT(*) FILTER (WHERE status='pending') AS pending,
                 COUNT(*) FILTER (WHERE status='suspended') AS suspended,
                 COUNT(*) FILTER (WHERE created_at>=NOW()-INTERVAL '7 days') AS new_week
               FROM users`),
        query(`SELECT
                 COUNT(*) AS total,
                 COALESCE(SUM(balance),0) AS total_balance,
                 COALESCE(AVG(balance),0) AS avg_balance
               FROM accounts WHERE status!='closed'`),
        query(`SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status='completed') AS completed,
                 COUNT(*) FILTER (WHERE status='failed')    AS failed,
                 COALESCE(SUM(amount) FILTER (WHERE status='completed'),0) AS total_volume,
                 COALESCE(SUM(fee)    FILTER (WHERE status='completed'),0) AS total_fees
               FROM transactions
               WHERE created_at>=NOW()-INTERVAL '30 days'`),
        query(`SELECT t.reference, t.type, t.amount, t.currency, t.status, t.created_at,
                      (u.first_name||' '||u.last_name) AS initiated_by_name
               FROM transactions t
               LEFT JOIN users u ON t.initiated_by=u.id
               ORDER BY t.created_at DESC LIMIT 10`),
      ]);
      res.json({ success: true, data: {
        users: users.rows[0],
        accounts: accounts.rows[0],
        transactions: txStats.rows[0],
        recentTransactions: recentTx.rows,
      }});
    } catch (e) { next(e); }
  },
];

exports.getAllUsers = [
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, role, search } = req.query;
      const { offset } = getPagination(page, limit);
      let where = 'WHERE 1=1';
      const params = [];
      let n = 1;
      if (status) { where += ` AND status=$${n++}`;  params.push(status); }
      if (role)   { where += ` AND role=$${n++}`;    params.push(role); }
      if (search) {
        where += ` AND (email ILIKE $${n} OR first_name ILIKE $${n} OR last_name ILIKE $${n})`;
        params.push(`%${search}%`); n++;
      }
      const cnt  = await query(`SELECT COUNT(*) FROM users ${where}`, params);
      const rows = await query(
        `SELECT id,email,first_name,last_name,phone,role,status,kyc_verified,last_login,created_at
         FROM users ${where} ORDER BY created_at DESC
         LIMIT $${n} OFFSET $${n + 1}`,
        [...params, parseInt(limit), offset]
      );
      res.json({ success: true, ...paginatedResponse(rows.rows, cnt.rows[0].count, page, limit) });
    } catch (e) { next(e); }
  },
];

exports.updateUserStatus = [
  requireRole('admin'),
  body('status').isIn(['active', 'suspended', 'pending']).withMessage('Statut invalide'),
  validate,
  async (req, res, next) => {
    try {
      const { rows } = await query(
        `UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2
         RETURNING id, email, status`,
        [req.body.status, req.params.userId]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
      await query(
        `INSERT INTO audit_logs (user_id,action,entity_type,entity_id,new_values,success)
         VALUES ($1,'UPDATE_USER_STATUS','user',$2,$3,true)`,
        [req.user.id, req.params.userId, JSON.stringify({ status: req.body.status })]
      );
      logger.info('Statut utilisateur changé', { by: req.user.id, target: req.params.userId, status: req.body.status });
      res.json({ success: true, message: 'Statut mis à jour', data: rows[0] });
    } catch (e) { next(e); }
  },
];

exports.verifyKYC = [
  requireRole('admin', 'agent'),
  body('verified').isBoolean().withMessage('Le champ verified doit être un booléen'),
  validate,
  async (req, res, next) => {
    try {
      const verified = req.body.verified === true || req.body.verified === 'true';
      const { rows } = await query(
        `UPDATE users
         SET kyc_verified=$1,
             status=CASE WHEN $1 THEN 'active' ELSE status END,
             updated_at=NOW()
         WHERE id=$2
         RETURNING id, email, kyc_verified, status`,
        [verified, req.params.userId]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });

      if (verified) {
        // Activer les comptes en attente
        await query(
          `UPDATE accounts SET status='active', updated_at=NOW() WHERE user_id=$1 AND status='pending'`,
          [req.params.userId]
        );
        await query(
          `INSERT INTO notifications (user_id,type,title,message)
           VALUES ($1,'kyc_verified','KYC Validé ✅',
           'Votre identité a été vérifiée. Vous pouvez utiliser tous les services.')`,
          [req.params.userId]
        );
      }

      res.json({ success: true, message: `KYC ${verified ? 'validé' : 'révoqué'}`, data: rows[0] });
    } catch (e) { next(e); }
  },
];
