'use strict';
const jwt    = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Vérifie le JWT Bearer et attache req.user */
const authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token manquant', code: 'MISSING_TOKEN' });
  }
  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const code = e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    return res.status(401).json({ success: false, error: e.message, code });
  }

  const { rows } = await query(
    `SELECT id, email, first_name, last_name, role, status, kyc_verified FROM users WHERE id = $1`,
    [decoded.userId]
  );
  if (!rows.length) return res.status(401).json({ success: false, error: 'Utilisateur introuvable', code: 'USER_NOT_FOUND' });

  const u = rows[0];
  if (u.status === 'suspended') return res.status(403).json({ success: false, error: 'Compte suspendu', code: 'SUSPENDED' });
  if (u.status === 'closed')    return res.status(403).json({ success: false, error: 'Compte fermé',    code: 'CLOSED' });

  req.user = u;
  next();
};

/** Middleware de vérification de rôle (doit venir après authenticate) */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Non authentifié' });
  if (!roles.includes(req.user.role)) {
    logger.warn('Accès refusé', { userId: req.user.id, role: req.user.role, required: roles, path: req.path });
    return res.status(403).json({ success: false, error: 'Permissions insuffisantes', code: 'FORBIDDEN' });
  }
  next();
};

/** Insère un audit log après la réponse */
const audit = (action) => async (req, res, next) => {
  const original = res.json.bind(res);
  res.json = async (body) => {
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, ip_address, success)
         VALUES ($1, $2, $3, $4)`,
        [req.user?.id || null, action, req.ip, body.success !== false]
      );
    } catch (_) { /* ne jamais bloquer la réponse pour un log */ }
    return original(body);
  };
  next();
};

module.exports = { authenticate, requireRole, audit };
