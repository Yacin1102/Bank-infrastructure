'use strict';
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/** Valide les champs express-validator et renvoie 400 si erreurs */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error:   'Données invalides',
      code:    'VALIDATION_ERROR',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/** Handler d'erreurs global – doit être en dernier dans app.use() */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error('Erreur non gérée', {
    error:  err.message,
    path:   req.path,
    method: req.method,
    user:   req.user?.id,
  });

  // Violations PostgreSQL
  if (err.code === '23505') return res.status(409).json({ success: false, error: 'Ressource déjà existante', code: 'DUPLICATE' });
  if (err.code === '23503') return res.status(400).json({ success: false, error: 'Référence invalide',        code: 'FK_VIOLATION' });
  if (err.code === '23514') return res.status(400).json({ success: false, error: 'Contrainte violée',         code: 'CHECK_VIOLATION' });

  // Erreurs métier (status HTTP explicite)
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error:   err.message,
      code:    err.code || 'ERROR',
    });
  }

  res.status(500).json({
    success: false,
    error:   process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
    code:    'INTERNAL_ERROR',
  });
};

/** Route introuvable */
const notFound = (req, res) =>
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} introuvable`, code: 'NOT_FOUND' });

module.exports = { validate, errorHandler, notFound };
