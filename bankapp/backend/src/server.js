'use strict';
require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const { testConnection, pool } = require('./config/database');
const routes      = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger      = require('./utils/logger');

const app  = express();
const PORT = parseInt(process.env.PORT) || 3001;
const VER  = process.env.API_VERSION || 'v1';

/* ── Proxy (Azure VM / Nginx) ── */
app.set('trust proxy', 1);

/* ── Sécurité ── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"] },
  },
}));

const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin:      (o, cb) => (!o || origins.includes(o)) ? cb(null, true) : cb(new Error(`CORS: origine refusée (${o})`)),
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ── Body / compression ── */
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

/* ── HTTP logs ── */
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) },
  skip:   req  => req.path.endsWith('/health'),
}));

/* ── Routes ── */
app.use(`/api/${VER}`, routes);

app.get('/', (req, res) =>
  res.json({ app: 'BankApp API', version: VER, health: `/api/${VER}/health` }));

/* ── 404 + Erreurs ── */
app.use(notFound);
app.use(errorHandler);

/* ── Démarrage ── */
async function start() {
  logger.info('Démarrage BankApp…');
  if (!await testConnection()) process.exit(1);

  const server = app.listen(PORT, '0.0.0.0', () =>
    logger.info(`✅ API démarrée sur http://0.0.0.0:${PORT}/api/${VER}`)
  );

  const shutdown = async (sig) => {
    logger.info(`Signal ${sig} – arrêt gracieux`);
    server.close(async () => {
      await pool.end();
      logger.info('Arrêt complet.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch(e => { logger.error(e.message); process.exit(1); });

module.exports = app; // pour les tests
