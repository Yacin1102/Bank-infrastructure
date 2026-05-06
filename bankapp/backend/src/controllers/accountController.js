'use strict';
const { body }     = require('express-validator');
const { validate } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const accountService  = require('../services/accountService');

exports.getUserAccounts = async (req, res, next) => {
  try {
    const data = await accountService.getUserAccounts(req.user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getAccount = async (req, res, next) => {
  try {
    const data = await accountService.getAccount(
      req.params.accountId, req.user.id, req.user.role === 'admin'
    );
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.getAccountSummary = async (req, res, next) => {
  try {
    const data = await accountService.getAccountSummary(req.params.accountId, req.user.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.createAccount = [
  body('type').isIn(['checking', 'savings', 'business', 'investment']).withMessage('Type invalide'),
  body('currency').optional().isIn(['TND', 'EUR', 'USD']).withMessage('Devise non supportée'),
  body('nickname').optional().isLength({ max: 100 }).trim(),
  validate,
  async (req, res, next) => {
    try {
      const { type, currency, nickname } = req.body;
      const data = await accountService.createAccount(req.user.id, type, currency, nickname);
      res.status(201).json({ success: true, message: 'Compte créé', data });
    } catch (e) { next(e); }
  },
];

exports.getAllAccounts = [
  requireRole('admin', 'agent'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, type, userId } = req.query;
      const data = await accountService.getAllAccounts(page, limit, { status, type, userId });
      res.json({ success: true, ...data });
    } catch (e) { next(e); }
  },
];

exports.setAccountStatus = [
  requireRole('admin'),
  body('action').isIn(['freeze', 'unfreeze', 'close']).withMessage('Action invalide'),
  validate,
  async (req, res, next) => {
    try {
      const statusMap = { freeze: 'frozen', unfreeze: 'active', close: 'closed' };
      const newStatus = statusMap[req.body.action];
      const data = await accountService.setAccountStatus(req.params.accountId, newStatus, req.user.id);
      res.json({ success: true, message: `Compte ${req.body.action}d avec succès`, data });
    } catch (e) { next(e); }
  },
];
