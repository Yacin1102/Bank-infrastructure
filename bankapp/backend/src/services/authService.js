'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { query, getClient } = require('../config/database');
const { sanitizeUser, generateAccountNumber, generateIBAN } = require('../utils/helpers');
const logger = require('../utils/logger');

const ROUNDS = () => parseInt(process.env.BCRYPT_ROUNDS) || 12;
const sign   = (payload, secret, exp) => jwt.sign(payload, secret, { expiresIn: exp });

class AuthService {
  /* ─────────────────── REGISTER ─────────────────── */
  async register({ email, password, first_name, last_name, phone, date_of_birth, national_id }, ip) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Unicité email
      const dup = await client.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
      if (dup.rows.length) throw { status: 409, message: 'Cet email est déjà utilisé', code: 'EMAIL_EXISTS' };

      // Unicité national_id
      if (national_id) {
        const dupN = await client.query('SELECT id FROM users WHERE national_id=$1', [national_id]);
        if (dupN.rows.length) throw { status: 409, message: 'Ce numéro national est déjà enregistré', code: 'NID_EXISTS' };
      }

      const hash   = await bcrypt.hash(password, ROUNDS());
      const uRes   = await client.query(
        `INSERT INTO users (email,password_hash,first_name,last_name,phone,date_of_birth,national_id,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
         RETURNING id,email,first_name,last_name,role,status,created_at`,
        [email.toLowerCase(), hash, first_name, last_name, phone || null, date_of_birth || null, national_id || null]
      );
      const user = uRes.rows[0];

      // Compte courant par défaut
      const num  = generateAccountNumber();
      const iban = generateIBAN(num);
      await client.query(
        `INSERT INTO accounts (account_number,user_id,type,currency,balance,iban,status)
         VALUES ($1,$2,'checking','TND',0.000,$3,'pending')`,
        [num, user.id, iban]
      );

      await client.query(
        `INSERT INTO notifications (user_id,type,title,message)
         VALUES ($1,'welcome','Bienvenue chez BankApp !',
         'Votre compte a été créé. En attente de validation KYC.')`,
        [user.id]
      );

      await client.query('COMMIT');
      logger.info('Inscription', { userId: user.id, email: user.email });
      return { user: sanitizeUser(user) };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ─────────────────── LOGIN ─────────────────── */
  async login(email, password, ip, ua) {
    const { rows } = await query(
      `SELECT id,email,password_hash,first_name,last_name,role,status,
              failed_login_attempts,locked_until
       FROM users WHERE email=$1`,
      [email.toLowerCase()]
    );

    // Timing-safe : toujours hasher même si user inexistant
    if (!rows.length) {
      await bcrypt.hash(password, ROUNDS());
      throw { status: 401, message: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' };
    }

    const u = rows[0];

    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      const t = new Date(u.locked_until).toLocaleTimeString('fr-FR');
      throw { status: 423, message: `Compte verrouillé jusqu'à ${t}`, code: 'ACCOUNT_LOCKED' };
    }
    if (u.status === 'suspended') throw { status: 403, message: 'Compte suspendu', code: 'SUSPENDED' };
    if (u.status === 'closed')    throw { status: 403, message: 'Compte fermé',    code: 'CLOSED' };

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      const attempts = u.failed_login_attempts + 1;
      const lock     = attempts >= 5 ? new Date(Date.now() + 30 * 60_000) : null;
      await query('UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3',
                  [attempts, lock, u.id]);
      const left = Math.max(0, 5 - attempts);
      throw {
        status:  401,
        message: left > 0
          ? `Mot de passe incorrect. ${left} tentative(s) restante(s).`
          : 'Compte verrouillé 30 minutes.',
        code: 'INVALID_CREDENTIALS',
      };
    }

    await query('UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=$1', [u.id]);

    const accessToken  = this._access(u);
    const refreshToken = await this._refresh(u.id, ip, ua);

    await query(
      `INSERT INTO audit_logs (user_id,action,ip_address,success) VALUES ($1,'LOGIN',$2,true)`,
      [u.id, ip]
    );

    logger.info('Login', { userId: u.id });
    return { user: sanitizeUser(u), accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRES_IN || '15m' };
  }

  /* ─────────────────── REFRESH ─────────────────── */
  async refreshToken(rawToken) {
    // Récupérer tous les refresh tokens non expirés non révoqués (limité)
    const { rows } = await query(
      `SELECT rt.id, rt.token_hash, rt.user_id,
              u.email, u.first_name, u.last_name, u.role, u.status
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.revoked=false AND rt.expires_at > NOW()
       ORDER BY rt.created_at DESC LIMIT 100`
    );

    let found = null;
    for (const row of rows) {
      if (await bcrypt.compare(rawToken, row.token_hash)) { found = row; break; }
    }
    if (!found) throw { status: 401, message: 'Refresh token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' };

    if (['suspended', 'closed'].includes(found.status))
      throw { status: 403, message: 'Compte inactif', code: 'ACCOUNT_INACTIVE' };

    // Rotation : révoquer l'ancien
    await query('UPDATE refresh_tokens SET revoked=true WHERE id=$1', [found.id]);

    const user = { id: found.user_id, email: found.email, first_name: found.first_name,
                   last_name: found.last_name, role: found.role };
    const accessToken  = this._access(user);
    const refreshToken = await this._refresh(user.id, null, null);
    return { accessToken, refreshToken, user };
  }

  /* ─────────────────── LOGOUT ─────────────────── */
  async logout(userId, ip) {
    await query('UPDATE refresh_tokens SET revoked=true WHERE user_id=$1 AND revoked=false', [userId]);
    await query(`INSERT INTO audit_logs (user_id,action,ip_address,success) VALUES ($1,'LOGOUT',$2,true)`, [userId, ip]);
  }

  /* ─────────────────── CHANGE PASSWORD ─────────────────── */
  async changePassword(userId, currentPassword, newPassword) {
    const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [userId]);
    if (!rows.length) throw { status: 404, message: 'Utilisateur introuvable', code: 'NOT_FOUND' };

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) throw { status: 401, message: 'Mot de passe actuel incorrect', code: 'WRONG_PASSWORD' };

    const hash = await bcrypt.hash(newPassword, ROUNDS());
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId]);
    await query('UPDATE refresh_tokens SET revoked=true WHERE user_id=$1', [userId]);
    logger.info('Mot de passe changé', { userId });
  }

  /* ── helpers privés ── */
  _access(u) {
    return sign({ userId: u.id, email: u.email, role: u.role },
                process.env.JWT_SECRET, process.env.JWT_EXPIRES_IN || '15m');
  }

  async _refresh(userId, ip, ua) {
    const raw  = uuid() + uuid();
    const hash = await bcrypt.hash(raw, 8); // rounds plus bas : token de session, pas mdp
    const exp  = new Date(Date.now() + 7 * 24 * 3_600_000);
    await query(
      `INSERT INTO refresh_tokens (user_id,token_hash,expires_at,ip_address)
       VALUES ($1,$2,$3,$4)`,
      [userId, hash, exp, ip || null]
    );
    return raw;
  }
}

module.exports = new AuthService();
