'use strict';
require('dotenv').config();
const { query, testConnection, pool } = require('./database');
const logger = require('../utils/logger');

const steps = [
  /* extensions */
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  /* users */
  `CREATE TABLE IF NOT EXISTS users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                VARCHAR(255) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100) NOT NULL,
    phone                VARCHAR(30),
    national_id          VARCHAR(50) UNIQUE,
    date_of_birth        DATE,
    address              TEXT,
    city                 VARCHAR(100),
    postal_code          VARCHAR(20),
    country              VARCHAR(100) DEFAULT 'Tunisie',
    role                 VARCHAR(20)  NOT NULL DEFAULT 'client'
                           CHECK (role IN ('client','agent','admin')),
    status               VARCHAR(20)  NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('active','pending','suspended','closed')),
    kyc_verified         BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until         TIMESTAMPTZ,
    last_login           TIMESTAMPTZ,
    two_factor_secret    VARCHAR(255),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* accounts */
  `CREATE TABLE IF NOT EXISTS accounts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           VARCHAR(30) NOT NULL
                     CHECK (type IN ('checking','savings','business','investment')),
    currency       VARCHAR(3)  NOT NULL DEFAULT 'TND',
    balance        NUMERIC(18,3) NOT NULL DEFAULT 0.000
                     CHECK (balance >= 0),
    credit_limit   NUMERIC(18,3) NOT NULL DEFAULT 0.000,
    interest_rate  NUMERIC(6,4)  NOT NULL DEFAULT 0.0000,
    status         VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','frozen','pending','closed')),
    iban           VARCHAR(40) UNIQUE,
    nickname       VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* transactions */
  `CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       VARCHAR(30) UNIQUE NOT NULL,
    from_account_id UUID REFERENCES accounts(id),
    to_account_id   UUID REFERENCES accounts(id),
    type            VARCHAR(30) NOT NULL
                      CHECK (type IN ('transfer','deposit','withdrawal','payment','fee','interest','refund')),
    amount          NUMERIC(18,3) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3)  NOT NULL DEFAULT 'TND',
    fee             NUMERIC(18,3) NOT NULL DEFAULT 0.000,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','failed','cancelled','reversed')),
    failure_reason  TEXT,
    initiated_by    UUID REFERENCES users(id),
    ip_address      INET,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* beneficiaries */
  `CREATE TABLE IF NOT EXISTS beneficiaries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(200) NOT NULL,
    account_number VARCHAR(20),
    iban           VARCHAR(40),
    bank_name      VARCHAR(200),
    swift_code     VARCHAR(11),
    is_internal    BOOLEAN NOT NULL DEFAULT false,
    nickname       VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* notifications */
  `CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(200) NOT NULL,
    message    TEXT NOT NULL,
    read       BOOLEAN NOT NULL DEFAULT false,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* refresh_tokens */
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT false,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* audit_logs */
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id),
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    UUID,
    old_values   JSONB,
    new_values   JSONB,
    ip_address   INET,
    success      BOOLEAN NOT NULL DEFAULT true,
    error_msg    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  /* indexes */
  `CREATE INDEX IF NOT EXISTS idx_accounts_user       ON accounts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_from             ON transactions(from_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_to               ON transactions(to_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_created          ON transactions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_ref              ON transactions(reference)`,
  `CREATE INDEX IF NOT EXISTS idx_notif_user          ON notifications(user_id, read, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_logs(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_user        ON refresh_tokens(user_id)`,

  /* updated_at trigger function */
  `CREATE OR REPLACE FUNCTION fn_set_updated_at()
   RETURNS TRIGGER LANGUAGE plpgsql AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_users_updated_at') THEN
       CREATE TRIGGER trg_users_updated_at
       BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
     END IF;
   END $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_accounts_updated_at') THEN
       CREATE TRIGGER trg_accounts_updated_at
       BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
     END IF;
   END $$`,
];

(async () => {
  if (!await testConnection()) process.exit(1);
  logger.info(`Exécution de ${steps.length} migrations…`);
  for (let i = 0; i < steps.length; i++) {
    try {
      await query(steps[i]);
      logger.info(`  [${i + 1}/${steps.length}] OK`);
    } catch (err) {
      logger.error(`  [${i + 1}/${steps.length}] ERREUR: ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  }
  logger.info('✅ Migrations terminées.');
  await pool.end();
})();
