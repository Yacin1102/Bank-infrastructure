# 🏦 BankApp — Plateforme Bancaire Complète

Stack : **Node.js 20 + Express** · **React 18 + Vite** · **PostgreSQL 16** · **Docker + Nginx**

---

## 📁 Structure

```
bank-app/
├── backend/
│   ├── src/
│   │   ├── config/        # database.js, migrate.js, seed.js
│   │   ├── controllers/   # auth, account, transaction, user
│   │   ├── middleware/     # auth JWT, errorHandler
│   │   ├── routes/        # index.js — toutes les routes
│   │   ├── services/      # logique métier
│   │   └── utils/         # logger, helpers
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # Layout (sidebar)
│   │   ├── pages/         # Login, Dashboard, Accounts, Transactions,
│   │   │                  # Transfer, Profile, Admin
│   │   └── utils/         # api.js (client Axios)
│   ├── Dockerfile
│   └── vite.config.js
├── infrastructure/
│   ├── nginx/             # nginx.conf + conf.d/bankapp.conf
│   ├── postgres/          # init.sql
│   └── scripts/           # deploy.sh, backup.sh
└── docker-compose.yml
```

---

## ⚡ Démarrage LOCAL (dev)

### Prérequis : Node.js 20+, PostgreSQL 15+

```bash
# 1. PostgreSQL — créer la base
psql -U postgres -c "CREATE DATABASE bankdb;"
psql -U postgres -c "CREATE USER bankuser WITH ENCRYPTED PASSWORD 'MonMotDePasse';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE bankdb TO bankuser;"
psql -U postgres -d bankdb -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 2. Backend
cd backend
cp .env.example .env
# Éditez .env : DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
nano .env

npm install
npm run migrate   # crée les 7 tables + index
npm run seed      # insère les comptes de test
npm run dev       # http://localhost:3001

# 3. Frontend (autre terminal)
cd ../frontend
npm install
npm run dev       # http://localhost:3000
```

---

## 🐳 Déploiement DOCKER (recommandé)

```bash
cd bank-app

# 1. Créer le .env (OBLIGATOIRE)
cp backend/.env.example .env
nano .env
# Changer : DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET

# 2. Build et démarrage
docker compose up -d --build

# 3. Migrations (attendre ~15s que Postgres soit prêt)
docker compose exec backend node src/config/migrate.js
docker compose exec backend node src/config/seed.js

# 4. Vérification
curl http://localhost/api/v1/health
# → {"success":true,"status":"healthy",...}
```

**Application disponible sur http://localhost**

### Commandes utiles

```bash
docker compose ps                     # état des services
docker compose logs -f backend        # logs API
docker compose logs -f nginx          # logs proxy
docker compose restart backend        # redémarrer l'API
docker compose down                   # arrêter
docker compose down -v                # arrêter + supprimer données
docker compose exec postgres psql -U bankuser -d bankdb   # shell DB
```

---

## ☁️ Déploiement AZURE VM

### 1. Créer la VM (Azure CLI)

```bash
az login

az group create --name rg-bankapp --location francecentral

az vm create \
  --resource-group rg-bankapp \
  --name vm-bankapp \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys

# Ouvrir ports 80 et 443
az vm open-port --resource-group rg-bankapp --name vm-bankapp --port 80  --priority 1001
az vm open-port --resource-group rg-bankapp --name vm-bankapp --port 443 --priority 1002

# Récupérer l'IP
az vm show --resource-group rg-bankapp --name vm-bankapp \
  --show-details --query publicIps -o tsv
```

### 2. Déployer

```bash
# Copier le projet sur la VM
scp -r ./bank-app azureuser@VOTRE_IP:/tmp/bank-app

# Se connecter et lancer le script
ssh azureuser@VOTRE_IP
sudo bash /tmp/bank-app/infrastructure/scripts/deploy.sh
```

Le script installe automatiquement Docker, configure UFW, Fail2ban, génère les secrets, build les containers, exécute les migrations et crée un service systemd.

### 3. HTTPS avec Let's Encrypt (optionnel)

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d votre-domaine.com
sudo cp /etc/letsencrypt/live/votre-domaine.com/fullchain.pem \
        /opt/bankapp/infrastructure/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/votre-domaine.com/privkey.pem \
        /opt/bankapp/infrastructure/nginx/ssl/key.pem
# Puis décommenter le bloc HTTPS dans infrastructure/nginx/conf.d/bankapp.conf
docker compose -f /opt/bankapp/docker-compose.yml restart nginx
```

### 4. Sauvegardes automatiques

```bash
echo "0 2 * * * root bash /opt/bankapp/infrastructure/scripts/backup.sh >> /var/log/bankapp-backup.log 2>&1" \
  | sudo tee /etc/cron.d/bankapp-backup
```

---

## 🔑 Comptes de test

| Rôle | Email | Mot de passe | Accès |
|------|-------|-------------|-------|
| 👑 Admin  | admin@bankapp.tn   | Admin@123456  | Tout |
| 🏦 Agent  | agent@bankapp.tn   | Agent@123456  | Dépôts, KYC |
| 👤 Client | client1@bankapp.tn | Client@123456 | Ses comptes |
| 👤 Client | client2@bankapp.tn | Client@123456 | Ses comptes |

> ⚠️ **Changer tous les mots de passe en production !**

---

## 📡 API Reference

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | /api/v1/auth/register | Non | Inscription |
| POST | /api/v1/auth/login | Non | Connexion → JWT |
| POST | /api/v1/auth/refresh | Non | Renouveler token |
| POST | /api/v1/auth/logout | Oui | Déconnexion |
| GET  | /api/v1/auth/me | Oui | Profil courant |
| PUT  | /api/v1/auth/change-password | Oui | Changer mdp |
| GET  | /api/v1/accounts | Oui | Mes comptes |
| POST | /api/v1/accounts | Oui | Créer un compte |
| GET  | /api/v1/accounts/:id | Oui | Détail compte |
| GET  | /api/v1/accounts/:id/summary | Oui | Résumé 30j |
| GET  | /api/v1/accounts/:id/transactions | Oui | Historique |
| POST | /api/v1/transactions/transfer | Oui | Virement |
| POST | /api/v1/transactions/deposit | Admin/Agent | Dépôt |
| GET  | /api/v1/transactions/report | Admin | Rapport |
| GET  | /api/v1/users/profile | Oui | Mon profil |
| PUT  | /api/v1/users/profile | Oui | Modifier profil |
| GET  | /api/v1/users/notifications | Oui | Notifications |
| GET  | /api/v1/admin/dashboard | Admin | Stats globales |
| GET  | /api/v1/admin/users | Admin | Tous utilisateurs |
| PUT  | /api/v1/admin/users/:id/status | Admin | Activer/Suspendre |
| PUT  | /api/v1/admin/users/:id/kyc | Admin/Agent | Valider KYC |
| GET  | /api/v1/health | Non | Health check |

---

## 🔒 Sécurité

- **JWT** Access 15min + Refresh 7j avec rotation automatique
- **Bcrypt** 12 rounds pour les mots de passe
- **Rate limiting** : 5/15min auth, 10/min transactions, 30r/s global
- **Helmet.js** : headers HTTP sécurisés (CSP, HSTS, XSS)
- **Verrou compte** : 5 tentatives → lock 30 minutes
- **Transactions ACID** : BEGIN/COMMIT/ROLLBACK PostgreSQL
- **Anti-deadlock** : verrouillage déterministe des comptes
- **Audit log** : toutes les actions sensibles tracées en base
- **CORS strict** : liste blanche d'origines
- **UFW + Fail2ban** en production

---

## 🗄️ Schéma DB

```
users          — Comptes utilisateurs (rôles: client/agent/admin)
accounts       — Comptes bancaires (checking/savings/business/investment)
transactions   — Toutes les opérations (transfer/deposit/withdrawal...)
beneficiaries  — Bénéficiaires enregistrés
notifications  — Notifications temps réel
refresh_tokens — Tokens de session JWT
audit_logs     — Journal d'audit complet
```

---

## 🐞 Dépannage

```bash
# PostgreSQL pas prêt
docker compose logs postgres
docker compose exec postgres pg_isready -U bankuser -d bankdb

# API ne répond pas
docker compose logs backend
docker compose exec nginx wget -qO- http://backend:3001/api/v1/health

# Reset complet
docker compose down -v
docker compose up -d
sleep 15
docker compose exec backend node src/config/migrate.js
docker compose exec backend node src/config/seed.js

# Voir les stats des containers
docker stats
```
