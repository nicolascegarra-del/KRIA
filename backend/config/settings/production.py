from .base import *  # noqa
from decouple import config

DEBUG = False

ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="localhost").split(",")

# ── Proxy SSL (Coolify/Traefik termina SSL y reenvía HTTP internamente) ────────
# Django confía en el header X-Forwarded-Proto para saber que la conexión
# original del cliente era HTTPS. Sin esto, SECURE_SSL_REDIRECT crea un bucle.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
SECURE_SSL_REDIRECT = False  # Traefik gestiona la redirección HTTP→HTTPS

# ── CORS ──────────────────────────────────────────────────────────────────────
# Configurable via env: CORS_ALLOWED_ORIGINS=https://app.tudominio.es,https://tudominio.es
_cors_origins = config("CORS_ALLOWED_ORIGINS", default="")
if _cors_origins:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]
else:
    # Fallback: acepta cualquier subdominio de TENANT_DOMAIN_SUFFIX
    _suffix = config("TENANT_DOMAIN_SUFFIX", default=".agamur.es").lstrip(".")
    import re
    CORS_ALLOWED_ORIGIN_REGEXES = [
        rf"^https://[\w-]+\.{re.escape(_suffix)}$",
        rf"^https://{re.escape(_suffix)}$",
    ]

# ── Security headers ───────────────────────────────────────────────────────────
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# ── Logging ────────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}
