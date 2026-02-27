#!/usr/bin/env bash
# =============================================================================
#  AGAMUR — Setup inicial del VPS (Ubuntu 22.04 / Debian 12)
#  Ejecutar como root una sola vez en el servidor Contabo:
#    bash setup-vps.sh
# =============================================================================
set -euo pipefail

# ── Colores ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Variables ────────────────────────────────────────────────────────────────
APP_USER="agamur"
APP_DIR="/opt/agamur"
REPO_URL="https://github.com/nicolascegarra-del/AGAMUR-V2.git"
BRANCH="Dev"

# ── 1. Actualizar sistema ────────────────────────────────────────────────────
info "Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Dependencias base ─────────────────────────────────────────────────────
info "Instalando dependencias base..."
apt-get install -y -qq \
  curl wget git ufw fail2ban unzip \
  ca-certificates gnupg lsb-release \
  apt-transport-https software-properties-common

# ── 3. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Instalando Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  info "Docker ya instalado: $(docker --version)"
fi

# ── 4. Usuario de aplicación ─────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  info "Creando usuario $APP_USER..."
  useradd -m -s /bin/bash -G docker "$APP_USER"
else
  info "Usuario $APP_USER ya existe."
  usermod -aG docker "$APP_USER"
fi

# ── 5. Clonar repositorio ────────────────────────────────────────────────────
info "Clonando repositorio..."
if [ -d "$APP_DIR" ]; then
  warning "El directorio $APP_DIR ya existe. Haciendo pull..."
  cd "$APP_DIR"
  sudo -u "$APP_USER" git pull origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# ── 6. Directorio SSL ────────────────────────────────────────────────────────
mkdir -p "$APP_DIR/nginx/ssl"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/nginx/ssl"

# ── 7. Fichero .env ──────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
  warning "¡IMPORTANTE! Edita $APP_DIR/.env con tus valores reales antes de continuar."
  warning "Ejecuta: nano $APP_DIR/.env"
else
  info ".env ya existe."
fi

# ── 8. Firewall (UFW) ────────────────────────────────────────────────────────
info "Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 9. fail2ban ──────────────────────────────────────────────────────────────
info "Configurando fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
EOF
systemctl enable --now fail2ban

# ── 10. Swap (si hay menos de 2GB RAM) ───────────────────────────────────────
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 2048 ] && [ ! -f /swapfile ]; then
  info "Creando 2GB de swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup completado. Próximos pasos:${NC}"
echo ""
echo -e "  1. Editar variables de entorno:"
echo -e "     ${YELLOW}nano $APP_DIR/.env${NC}"
echo ""
echo -e "  2. Obtener certificado SSL:"
echo -e "     ${YELLOW}cd $APP_DIR && bash scripts/init-ssl.sh${NC}"
echo ""
echo -e "  3. Arrancar la aplicación:"
echo -e "     ${YELLOW}cd $APP_DIR && bash scripts/deploy.sh${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
