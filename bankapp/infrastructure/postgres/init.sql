-- Exécuté automatiquement au 1er démarrage du container PostgreSQL
-- Active les extensions nécessaires

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
