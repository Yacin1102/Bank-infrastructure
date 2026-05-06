'use strict';
const { Pool } = require('pg');
const logger   = require('../utils/logger');

const pool = new Pool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 5432,
  database:           process.env.DB_NAME     || 'bankdb',
  user:               process.env.DB_USER     || 'bankuser',
  password:           process.env.DB_PASSWORD,
  max:                parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis:  30_000,
  connectionTimeoutMillis: 3_000,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  logger.error('Erreur inattendue pool PostgreSQL', { error: err.message });
});

/** Exécute une query simple */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    logger.debug('query', { ms: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('query error', { text: text.slice(0, 80), error: err.message });
    throw err;
  }
};

/** Retourne un client avec transaction manuelle */
const getClient = () => pool.connect();

/** Teste la connexion au démarrage */
const testConnection = async () => {
  try {
    const r = await pool.query('SELECT NOW() AS now');
    logger.info('✅ PostgreSQL connecté', { time: r.rows[0].now });
    return true;
  } catch (err) {
    logger.error('❌ PostgreSQL connexion échouée', { error: err.message });
    return false;
  }
};

module.exports = { query, getClient, testConnection, pool };
