#!/bin/bash
# ================================================================
# deploy.sh — BankApp deployment (Ubuntu 22.04 / Azure VM)
# Usage : sudo bash deploy.sh
# ================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && die "Exécuter avec sudo"

APP_DIR="/opt/bankapp"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     BankApp — Déploiement auto       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Dépendances ──
info "Mise à jour du système..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban wget > /dev/null 2>&1
ok "Dépendances installées"

# ── Docker ──
if ! command -v docker &>/dev/null; then
    info "Installation Docker..."
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
    systemctl enable --now docker
    ok "Docker installé"
else
    ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# ── Docker Compose ──
if ! docker compose version &>/dev/null 2>&1; then
    info "Installation Docker Compose plugin..."
    mkdir -p /usr/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
        -o /usr/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/lib/docker/cli-plugins/docker-compose
    ok "Docker Compose installé"
else
    ok "Docker Compose $(docker compose version --short)"
fi

# ── Copier les sources ──
info "Copie des sources vers $APP_DIR..."
mkdir -p "$APP_DIR"
if [[ -d "/tmp/bank-app" ]]; then
    cp -r /tmp/bank-app/. "$APP_DIR/"
    ok "Sources copiées"
else
    warn "Sources non trouvées dans /tmp/bank-app"
    warn "Clonez votre repo dans /tmp/bank-app ou copiez manuellement"
fi

cd "$APP_DIR"

# ── Générer .env ──
if [[ ! -f ".env" ]]; then
    info "Génération des secrets..."
    JWT=$(openssl rand -base64 64 | tr -d '\n/+=')
    JR=$(openssl rand -base64 64 | tr -d '\n/+=')
    DP=$(openssl rand -base64 24 | tr -d '\n/+=')
    cat > .env << EOF
NODE_ENV=production
DB_NAME=bankdb
DB_USER=bankuser
DB_PASSWORD=${DP}
JWT_SECRET=${JWT}
JWT_REFRESH_SECRET=${JR}
ALLOWED_ORIGINS=http://$(curl -s ifconfig.me 2>/dev/null || echo 'localhost'),http://localhost
VITE_API_URL=/api/v1
EOF
    ok ".env créé avec secrets générés aléatoirement"
    warn "Sauvegardez ce fichier .env !"
fi

# ── Firewall ──
info "Configuration UFW..."
ufw --force reset > /dev/null 2>&1
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
ok "Firewall : SSH, 80, 443 autorisés"

# ── Fail2ban ──
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
[sshd]
enabled = true
EOF
systemctl enable --now fail2ban > /dev/null 2>&1
ok "Fail2ban configuré"

# ── SSL dir ──
mkdir -p infrastructure/nginx/ssl

# ── Build & démarrage ──
info "Build des containers (peut prendre 2-5 min)..."
docker compose build --no-cache 2>&1 | grep -E "Step|error|ERROR|=>|DONE" || true

info "Démarrage des services..."
docker compose up -d
ok "Services démarrés"

# ── Migrations ──
info "Attente PostgreSQL..."
sleep 15
docker compose exec -T backend node src/config/migrate.js
ok "Migrations exécutées"

docker compose exec -T backend node src/config/seed.js
ok "Données initiales chargées"

# ── Systemd ──
cat > /etc/systemd/system/bankapp.service << EOF
[Unit]
Description=BankApp
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=docker compose up -d
ExecStop=docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable bankapp.service > /dev/null 2>&1
ok "Service systemd bankapp activé (démarrage auto)"

# ── Résumé ──
IP=$(curl -s ifconfig.me 2>/dev/null || echo "VOTRE_IP")
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          DÉPLOIEMENT RÉUSSI ✓                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐  Application  :  http://${IP}"
echo -e "  🔧  API health   :  http://${IP}/api/v1/health"
echo -e "  📋  Logs         :  docker compose -f ${APP_DIR}/docker-compose.yml logs -f"
echo ""
echo -e "  👑  admin@bankapp.tn   / Admin@123456"
echo -e "  🏦  agent@bankapp.tn   / Agent@123456"
echo -e "  👤  client1@bankapp.tn / Client@123456"
echo ""
warn "CHANGEZ LES MOTS DE PASSE PAR DÉFAUT !"
