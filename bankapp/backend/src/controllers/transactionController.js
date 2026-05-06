'use strict';
const { body }     = require('express-validator');
const { validate } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const txService       = require('../services/transactionService');

exports.transfer = [
  body('fromAccountId').isUUID().withMessage('Compte source invalide'),
  body('toAccountId').isUUID().withMessage('Compte destination invalide'),
  body('amount').isFloat({ min: 0.001 }).withMessage('Montant invalide (min 0.001)'),
  body('description').optional().isLength({ max: 255 }).trim(),
  validate,
  async (req, res, next) => {
    try {
      const { fromAccountId, toAccountId, amount, description } = req.body;
      if (fromAccountId === toAccountId)
        return res.status(400).json({ success: false, error: 'Comptes source et destination identiques', code: 'SAME_ACCOUNT' });
      const data = await txService.transfer({ fromAccountId, toAccountId, amount, description }, req.user.id, req.ip);
      res.status(201).json({ success: true, message: 'Virement effectué', data });
    } catch (e) { next(e); }
  },
];

exports.deposit = [
  requireRole('admin', 'agent'),
  body('accountId').isUUID().withMessage('Compte invalide'),
  body('amount').isFloat({ min: 1 }).withMessage('Montant invalide (min 1)'),
  body('description').optional().isLength({ max: 255 }).trim(),
  validate,
  async (req, res, next) => {
    try {
      const data = await txService.deposit(req.body, req.user.id);
      res.status(201).json({ success: true, message: 'Dépôt effectué', data });
    } catch (e) { next(e); }
  },
];

exports.getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, startDate, endDate } = req.query;
    const data = await txService.getTransactions(
      req.params.accountId, req.user.id,
      page, limit,
      { type, status, startDate, endDate }
    );
    res.json({ success: true, ...data });
  } catch (e) { next(e); }
};

exports.getReport = [
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const data = await txService.getReport(startDate, endDate);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  },
];
