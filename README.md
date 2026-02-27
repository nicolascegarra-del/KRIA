# AGAMUR — Plataforma de Gestión de Libros Genealógicos Avícolas

SaaS multi-tenant PWA para asociaciones avícolas. Gestión de socios, registro genealógico de aves, evaluaciones morfológicas, generación de certificados PDF y catálogos de reproductores.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.1 + DRF |
| Frontend | React 18 + Vite + TypeScript + PWA |
| Base de datos | PostgreSQL 16 |
| Caché / Cola | Redis 7 + Celery |
| Ficheros | MinIO (S3-compatible) |
| PDF | WeasyPrint + matplotlib |
| Excel | openpyxl + pandas |
| Proxy | Nginx + Let's Encrypt |
| Deploy | Docker Compose en VPS Contabo |

---

## Desarrollo local

```bash
# 1. Clonar
git clone https://github.com/nicolascegarra-del/AGAMUR-V2.git -b Dev
cd AGAMUR-V2

# 2. Variables de entorno
cp .env.example .env         # editar si es necesario (valores por defecto funcionan en local)

# 3. Levantar servicios
docker compose up -d

# 4. Seed del admin demo
docker compose exec backend python manage.py seed_admin

# 5. Frontend en http://localhost:5173
#    Backend  en http://localhost:8000
#    MinIO    en http://localhost:9001  (minioadmin / minioadmin)
```

### Credenciales demo
| Campo | Valor |
|-------|-------|
| URL | http://localhost:5173 |
| Código de asociación | `demo` |
| Email | admin@agamur.es |
| Contraseña | agamur2024! |

---

## Despliegue en VPS Contabo

### Requisitos del servidor
- Ubuntu 22.04 LTS (o Debian 12)
- Mínimo 4 vCPU / 4 GB RAM / 80 GB SSD
- IP pública fija
- Dominio apuntando al servidor (registro `A` y `*.dominio.es`)

### Paso 1 — Configurar GitHub Secrets

En `Settings → Secrets → Actions` del repositorio, añade:

| Secret | Descripción |
|--------|-------------|
| `VPS_HOST` | IP pública del servidor Contabo |
| `VPS_USER` | Usuario SSH (ej. `agamur` o `root`) |
| `VPS_SSH_KEY` | Clave privada SSH (contenido completo del `id_ed25519`) |
| `VPS_PORT` | Puerto SSH (opcional, por defecto `22`) |

### Paso 2 — Setup inicial del servidor

Conectarse al VPS y ejecutar:

```bash
# Copiar y ejecutar el script de setup
curl -fsSL https://raw.githubusercontent.com/nicolascegarra-del/AGAMUR-V2/Dev/scripts/setup-vps.sh | bash
```

O manualmente:

```bash
git clone https://github.com/nicolascegarra-del/AGAMUR-V2.git -b Dev /opt/agamur
cd /opt/agamur
bash scripts/setup-vps.sh
```

### Paso 3 — Variables de entorno de producción

```bash
cd /opt/agamur
cp .env.production.example .env
nano .env          # Rellenar TODOS los valores marcados con CHANGE_ME
```

Variables críticas:

```env
DJANGO_SECRET_KEY=<50 caracteres aleatorios>
POSTGRES_PASSWORD=<contraseña fuerte>
MINIO_ACCESS_KEY=<usuario minio>
MINIO_SECRET_KEY=<contraseña minio>
DOMAIN=tudominio.es
CERTBOT_EMAIL=admin@tudominio.es
FRONTEND_URL=https://tudominio.es
```

> Generar una clave secreta: `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`

### Paso 4 — Obtener certificado SSL

```bash
cd /opt/agamur
bash scripts/init-ssl.sh
```

Este script:
1. Levanta un nginx temporal en el puerto 80
2. Solicita certificado wildcard a Let's Encrypt via ACME HTTP-01
3. Guarda los certificados en `nginx/ssl/`

### Paso 5 — Primer deploy

```bash
cd /opt/agamur
bash scripts/deploy.sh
```

La aplicación quedará disponible en `https://tudominio.es`.

---

## Deploy automático (CI/CD)

Cada `git push` a la rama `Dev` desencadena el pipeline de GitHub Actions:

```
push → Dev
  │
  ├── [test]   Django check + migrate + tsc
  ├── [build]  Docker build backend + frontend
  └── [deploy] SSH al VPS → scripts/deploy.sh
```

El deploy actualiza el código sin tiempo de inactividad (rolling restart de Docker).

---

## Comandos útiles en el VPS

```bash
cd /opt/agamur

# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f

# Ver estado de contenedores
docker compose -f docker-compose.prod.yml ps

# Shell Django
docker compose -f docker-compose.prod.yml exec backend python manage.py shell

# Backup manual de base de datos
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U agamur agamur > backup_$(date +%Y%m%d).sql

# Aplicar políticas RLS de PostgreSQL (solo una vez)
docker compose -f docker-compose.prod.yml exec db \
  psql -U agamur agamur < backend/scripts/rls_policies.sql

# Crear nuevo tenant
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from apps.tenants.models import Tenant
Tenant.objects.create(name='Mi Asociación', slug='miasoc')
"
```

---

## Arquitectura multi-tenant

Cada asociación tiene su subdominio: `asoc.tudominio.es`

La resolución de tenant se hace por este orden de prioridad:
1. Subdominio: `slug.tudominio.es`
2. Header HTTP: `X-Tenant-Slug: slug`
3. Dominio personalizado: `www.miasociacion.com`

---

## Estructura del proyecto

```
agamur/
├── backend/              # Django 5.1 + DRF
│   ├── apps/
│   │   ├── tenants/      # Modelo Tenant, branding
│   │   ├── accounts/     # Usuario + Socio, JWT, seed_admin
│   │   ├── animals/      # Animal, máquina de estados, señales
│   │   ├── lotes/        # Lotes de cría
│   │   ├── evaluaciones/ # Evaluación morfológica (6 campos)
│   │   ├── conflicts/    # Conflictos de titularidad, dashboard
│   │   ├── imports/      # Importación Excel (Pandas + Celery)
│   │   ├── reports/      # PDF/Excel (WeasyPrint + openpyxl)
│   │   └── reproductores/# Catálogo público
│   ├── core/             # TenantMiddleware, TenantManager, permissions
│   ├── config/           # Settings (base/dev/prod), URLs, Celery
│   ├── templates/reports/# Plantillas WeasyPrint
│   └── scripts/          # RLS SQL, backup.sh
├── frontend/             # React 18 + Vite + TS + PWA
│   └── src/
│       ├── api/          # Axios + React Query por recurso
│       ├── components/   # AnimalCard, AnimalStateChip, GenealogyTooltip…
│       ├── pages/        # auth/, socio/, gestion/
│       └── store/        # Zustand (auth + tenant)
├── nginx/                # nginx.prod.conf + snippets
├── scripts/              # setup-vps.sh, init-ssl.sh, deploy.sh
├── .github/workflows/    # CI/CD GitHub Actions
├── docker-compose.yml           # Desarrollo local
└── docker-compose.prod.yml      # Producción standalone
```

---

## Licencia

Propietario — © AGAMUR. Todos los derechos reservados.
