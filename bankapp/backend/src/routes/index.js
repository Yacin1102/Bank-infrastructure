'use strict';
const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const auth   = require('../controllers/authController');
const acc    = require('../controllers/accountController');
const tx     = require('../controllers/transactionController');
const user   = require('../controllers/userController');

const router = express.Router();

const rl = (max, windowMs = 15 * 60_000) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false,
               message: { success: false, error: 'Trop de requêtes. Réessayez plus tard.', code: 'RATE_LIMITED' } });

/* ── Health ── */
router.get('/health', (req, res) =>
  res.json({ success: true, status: 'healthy', uptime: process.uptime(), ts: new Date() }));

/* ── Auth ── */
router.post('/auth/register',         rl(5),  auth.register);
router.post('/auth/login',            rl(10), auth.login);
router.post('/auth/refresh',                  auth.refreshToken);
router.post('/auth/logout',           authenticate, auth.logout);
router.get ('/auth/me',               authenticate, auth.me);
router.put ('/auth/change-password',  authenticate, auth.changePassword);

/* ── User ── */
router.get('/users/profile',   authenticate, user.getProfile);
router.put('/users/profile',   authenticate, user.updateProfile);

/* notifications : read-all AVANT :id pour éviter le shadowing */
router.get('/users/notifications',           authenticate, user.getNotifications);
router.put('/users/notifications/read-all',  authenticate, user.markAllNotificationsRead);
router.put('/users/notifications/:notificationId/read', authenticate, user.markNotificationRead);

/* ── Admin ── */
router.get('/admin/dashboard',              authenticate, user.getDashboardStats);
router.get('/admin/users',                  authenticate, user.getAllUsers);
router.put('/admin/users/:userId/status',   authenticate, user.updateUserStatus);
router.put('/admin/users/:userId/kyc',      authenticate, user.verifyKYC);

/* ── Accounts ── */
router.get ('/accounts',          authenticate, acc.getUserAccounts);
router.post('/accounts',          authenticate, acc.createAccount);
/* /accounts/all AVANT /accounts/:accountId pour éviter le shadowing */
router.get ('/accounts/all',      authenticate, acc.getAllAccounts);
router.get ('/accounts/:accountId',         authenticate, acc.getAccount);
router.get ('/accounts/:accountId/summary', authenticate, acc.getAccountSummary);
router.put ('/accounts/:accountId/status',  authenticate, acc.setAccountStatus);

/* ── Transactions ── */
router.post('/transactions/transfer', authenticate, rl(10, 60_000), tx.transfer);
router.post('/transactions/deposit',  authenticate, tx.deposit);
router.get ('/transactions/report',   authenticate, tx.getReport);
router.get ('/accounts/:accountId/transactions', authenticate, tx.getTransactions);

module.exports = router;
