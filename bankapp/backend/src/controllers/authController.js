'use strict';
const { body } = require('express-validator');
const { validate } = require('../middleware/errorHandler');
const authService  = require('../services/authService');

const pwdRules = body('password')
  .isLength({ min: 8 }).withMessage('Minimum 8 caractères')
  .matches(/[A-Z]/).withMessage('Au moins une majuscule')
  .matches(/[a-z]/).withMessage('Au moins une minuscule')
  .matches(/\d/).withMessage('Au moins un chiffre')
  .matches(/[@$!%*?&]/).withMessage('Au moins un symbole (@$!%*?&)');

exports.register = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  pwdRules,
  body('first_name').trim().isLength({ min: 2, max: 100 }).withMessage('Prénom invalide'),
  body('last_name').trim().isLength({ min: 2, max: 100 }).withMessage('Nom invalide'),
  body('phone').optional().isMobilePhone().withMessage('Téléphone invalide'),
  body('date_of_birth').optional().isDate().withMessage('Date de naissance invalide'),
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.register(req.body, req.ip);
      res.status(201).json({ success: true, message: 'Compte créé. Validation KYC requise.', data });
    } catch (e) { next(e); }
  },
];

exports.login = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  validate,
  async (req, res, next) => {
    try {
      const data = await authService.login(req.body.email, req.body.password, req.ip, req.headers['user-agent']);
      res.json({ success: true, message: 'Connexion réussie', data });
    } catch (e) { next(e); }
  },
];

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'refreshToken requis' });
    const data = await authService.refreshToken(refreshToken);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id, req.ip);
    res.json({ success: true, message: 'Déconnecté' });
  } catch (e) { next(e); }
};

exports.me = (req, res) =>
  res.json({ success: true, data: { user: req.user } });

exports.changePassword = [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Minimum 8 caractères')
    .matches(/[A-Z]/).withMessage('Au moins une majuscule')
    .matches(/[a-z]/).withMessage('Au moins une minuscule')
    .matches(/\d/).withMessage('Au moins un chiffre')
    .matches(/[@$!%*?&]/).withMessage('Au moins un symbole'),
  validate,
  async (req, res, next) => {
    try {
      await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
      res.json({ success: true, message: 'Mot de passe modifié. Reconnectez-vous.' });
    } catch (e) { next(e); }
  },
];
