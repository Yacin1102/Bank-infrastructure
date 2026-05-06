'use strict';
const winston              = require('winston');
const DailyRotateFile      = require('winston-daily-rotate-file');
const path                 = require('path');
const fs                   = require('fs');

const logDir   = process.env.LOG_DIR || './logs';
const logLevel = process.env.LOG_LEVEL || 'info';

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} | ${message}${extra}`;
  })
);

const logger = winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), fmt),
    }),
    new DailyRotateFile({
      dirname:      logDir,
      filename:     'app-%DATE%.log',
      datePattern:  'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles:     '30d',
      format:       winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
    new DailyRotateFile({
      dirname:      logDir,
      filename:     'error-%DATE%.log',
      datePattern:  'YYYY-MM-DD',
      level:        'error',
      zippedArchive: true,
      maxFiles:     '90d',
      format:       winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],
});

module.exports = logger;
