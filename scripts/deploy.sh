#!/usr/bin/env bash
# =============================================================================
#  AGAMUR — Script de despliegue (VPS)
#  Ejecutar desde /opt/agamur en el servidor:
#    bash scripts/deploy.sh
#
#  También invocado por GitHub Actions vía SSH.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"
BRANCH="${DEPLOY_BRANCH:-Dev}"

cd "$APP_DIR"

info "═══════════════════════════════════════════════"
info "  Iniciando deploy AGAMUR — rama: $BRANCH"
info "═══════════════════════════════════════════════"

# ── 1. Git pull ───────────────────────────────────────────────────────────────
info "Actualizando código..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
info "Commit actual: $(git log -1 --format='%h %s')"

# ── 2. Verificar .env ─────────────────────────────────────────────────────────
[ -f .env ] || error ".env no encontrado en $APP_DIR. Cópialo desde .env.production.example"

# ── 3. Build de imágenes ──────────────────────────────────────────────────────
info "Construyendo imágenes Docker..."
$COMPOSE build --pull --no-cache backend frontend

# ── 4. Migraciones (con el nuevo código pero sin parar el servicio) ───────────
info "Ejecutando migraciones..."
$COMPOSE run --rm backend python manage.py migrate --noinput

# ── 5. Colectar estáticos ─────────────────────────────────────────────────────
info "Colectando archivos estáticos..."
$COMPOSE run --rm backend python manage.py collectstatic --noinput --clear

# ── 6. Reiniciar servicios con zero-downtime ──────────────────────────────────
info "Reiniciando servicios..."
$COMPOSE up -d --remove-orphans

# ── 7. Esperar a que el backend responda ──────────────────────────────────────
info "Verificando health check..."
MAX_RETRIES=30
RETRY=0
until curl -sf http://localhost:8000/health/ > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  [ $RETRY -ge $MAX_RETRIES ] && error "Backend no responde tras ${MAX_RETRIES}s"
  echo -n "."
  sleep 2
done
echo ""
info "Backend OK"

# ── 8. Seed admin (solo si es el primer deploy) ───────────────────────────────
if $COMPOSE exec backend python manage.py shell -c \
   "from apps.accounts.models import User; exit(0 if User.objects.exists() else 1)" 2>/dev/null; then
  info "Base de datos ya tiene usuarios — omitiendo seed_admin"
else
  info "Primer deploy detectado — creando superadmin..."
  $COMPOSE exec backend python manage.py seed_admin
fi

# ── 9. Limpiar imágenes antiguas ──────────────────────────────────────────────
info "Limpiando imágenes Docker antiguas..."
docker image prune -f --filter "until=24h" 2>/dev/null || true

# ── Resumen ───────────────────────────────────────────────────────────────────
info "═══════════════════════════════════════════════"
info "  Deploy completado con éxito"
info "  Servicios activos:"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}"
info "═══════════════════════════════════════════════"
