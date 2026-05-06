'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, testConnection, pool } = require('./database');
const { generateAccountNumber, generateIBAN } = require('../utils/helpers');
const logger = require('../utils/logger');

async function seed() {
  if (!await testConnection()) process.exit(1);
  const R = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  logger.info('🌱 Seeding…');

  try {
    /* ── ADMIN ── */
    const ap = await bcrypt.hash('Admin@123456', R);
    const ar = await query(`
      INSERT INTO users (email,password_hash,first_name,last_name,phone,role,status,kyc_verified)
      VALUES ('admin@bankapp.tn',$1,'Admin','Système','+21698765432','admin','active',true)
      ON CONFLICT (email) DO UPDATE SET password_hash=$1, status='active', kyc_verified=true
      RETURNING id`, [ap]);
    logger.info('  ✅ admin@bankapp.tn / Admin@123456');

    /* ── AGENT ── */
    const agp = await bcrypt.hash('Agent@123456', R);
    await query(`
      INSERT INTO users (email,password_hash,first_name,last_name,phone,role,status,kyc_verified)
      VALUES ('agent@bankapp.tn',$1,'Ahmed','Ben Ali','+21620111222','agent','active',true)
      ON CONFLICT (email) DO UPDATE SET password_hash=$1, status='active', kyc_verified=true`, [agp]);
    logger.info('  ✅ agent@bankapp.tn / Agent@123456');

    /* ── CLIENT 1 ── */
    const c1p = await bcrypt.hash('Client@123456', R);
    const c1r = await query(`
      INSERT INTO users (email,password_hash,first_name,last_name,phone,national_id,
                         date_of_birth,address,city,role,status,kyc_verified)
      VALUES ('client1@bankapp.tn',$1,'Mariem','Trabelsi','+21620333444','12345678',
              '1990-05-15','15 Rue de la République','Tunis','client','active',true)
      ON CONFLICT (email) DO UPDATE SET password_hash=$1, status='active', kyc_verified=true
      RETURNING id`, [c1p]);
    const c1id = c1r.rows[0].id;
    await seedAccounts(c1id, [
      { type: 'checking', balance: 15420.500, nickname: 'Compte principal' },
      { type: 'savings',  balance: 85000.000, nickname: 'Épargne retraite', interest_rate: 0.035 },
    ]);
    logger.info('  ✅ client1@bankapp.tn / Client@123456  (2 comptes)');

    /* ── CLIENT 2 ── */
    const c2p = await bcrypt.hash('Client@123456', R);
    const c2r = await query(`
      INSERT INTO users (email,password_hash,first_name,last_name,phone,national_id,
                         date_of_birth,city,role,status,kyc_verified)
      VALUES ('client2@bankapp.tn',$1,'Karim','Mansouri','+21655666777','87654321',
              '1985-11-20','Sfax','client','active',true)
      ON CONFLICT (email) DO UPDATE SET password_hash=$1, status='active', kyc_verified=true
      RETURNING id`, [c2p]);
    const c2id = c2r.rows[0].id;
    await seedAccounts(c2id, [
      { type: 'checking', balance: 3250.750, nickname: 'Compte courant' },
    ]);
    logger.info('  ✅ client2@bankapp.tn / Client@123456  (1 compte)');

    logger.info('');
    logger.info('🎉 Seed terminé !');
    logger.info('   👑 admin@bankapp.tn   / Admin@123456');
    logger.info('   🏦 agent@bankapp.tn   / Agent@123456');
    logger.info('   👤 client1@bankapp.tn / Client@123456');
    logger.info('   👤 client2@bankapp.tn / Client@123456');
  } finally {
    await pool.end();
  }
}

async function seedAccounts(userId, accounts) {
  for (const a of accounts) {
    const num  = generateAccountNumber();
    const iban = generateIBAN(num);
    await query(`
      INSERT INTO accounts (account_number,user_id,type,currency,balance,interest_rate,iban,nickname,status)
      VALUES ($1,$2,$3,'TND',$4,$5,$6,$7,'active')
      ON CONFLICT (account_number) DO NOTHING`,
      [num, userId, a.type, a.balance, a.interest_rate || 0, iban, a.nickname || null]);
  }
}

seed().catch(e => { logger.error(e.message); process.exit(1); });
