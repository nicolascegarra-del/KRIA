#!/usr/bin/env bash
# =============================================================================
#  AGAMUR — Obtener certificado SSL con Let's Encrypt (primera vez)
#  Ejecutar desde /opt/agamur:
#    bash scripts/init-ssl.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Cargar DOMAIN y CERTBOT_EMAIL desde .env
if [ -f .env ]; then
  export $(grep -E '^(DOMAIN|CERTBOT_EMAIL)' .env | xargs)
fi

[ -z "${DOMAIN:-}" ]          && error "DOMAIN no definido en .env"
[ -z "${CERTBOT_EMAIL:-}" ]   && error "CERTBOT_EMAIL no definido en .env"

info "Dominio: $DOMAIN"
info "Email:   $CERTBOT_EMAIL"

# ── 1. Levantar nginx en modo HTTP (sin SSL) para el challenge ACME ──────────
info "Arrancando nginx temporal para ACME challenge..."

# Usar configuración HTTP-only temporal
cat > /tmp/nginx-http-only.conf << EOF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN *.$DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
            try_files \$uri =404;
        }
        location / { return 200 'ok'; }
    }
}
EOF

docker run -d --rm \
  --name nginx-acme \
  -p 80:80 \
  -v /tmp/nginx-http-only.conf:/etc/nginx/nginx.conf:ro \
  -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
  nginx:1.27-alpine 2>/dev/null || true

sleep 3

# ── 2. Obtener certificado wildcard ──────────────────────────────────────────
info "Solicitando certificado SSL para *.$DOMAIN y $DOMAIN ..."

mkdir -p nginx/ssl nginx/certbot-webroot

docker run --rm \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  -d "*.$DOMAIN"

# ── 3. Parar nginx temporal ──────────────────────────────────────────────────
docker stop nginx-acme 2>/dev/null || true

# ── 4. Crear symlinks que espera nginx.prod.conf ─────────────────────────────
info "Configurando symlinks de certificados..."
CERT_DIR="nginx/ssl/live/$DOMAIN"

if [ ! -f "nginx/ssl/fullchain.pem" ]; then
  ln -sf "$CERT_DIR/fullchain.pem" nginx/ssl/fullchain.pem  2>/dev/null || true
  ln -sf "$CERT_DIR/privkey.pem"   nginx/ssl/privkey.pem    2>/dev/null || true
fi

info "¡Certificado SSL obtenido correctamente!"
info "Ahora puedes ejecutar: bash scripts/deploy.sh"
