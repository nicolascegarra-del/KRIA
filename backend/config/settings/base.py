"""
Base settings shared across all environments.
"""
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    "django_celery_results",
    "storages",
    # Internal apps
    "core",
    "apps.tenants",
    "apps.accounts",
    "apps.animals",
    "apps.lotes",
    "apps.evaluaciones",
    "apps.conflicts",
    "apps.imports",
    "apps.reports",
    "apps.reproductores",
    "apps.granjas",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.TenantMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASES = {
    "default": dj_database_url.config(
        default=config("DATABASE_URL", default="postgres://agamur:agamur_dev_password@localhost:5432/agamur"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# ─── Auth ─────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

# Multi-tenant: email is unique per tenant (unique_together), not globally unique.
# Django auth.E003 requires global unique=True on USERNAME_FIELD, which would break
# multi-tenancy, so we silence it intentionally.
SILENCED_SYSTEM_CHECKS = ["auth.E003"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── DRF ──────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # ── Throttling (defense-in-depth; Nginx also rate-limits auth) ───────────
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",       # unauthenticated (login, branding, public catalog)
        "user": "300/min",      # authenticated general use
        "uploads": "20/min",    # photo upload, import, report generation
    },
}

# ─── JWT ──────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("ACCESS_TOKEN_LIFETIME_MINUTES", default=15, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "TOKEN_OBTAIN_SERIALIZER": "apps.accounts.serializers.CustomTokenObtainPairSerializer",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ─── i18n ─────────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "es-es"
TIME_ZONE = "Europe/Madrid"
USE_I18N = True
USE_TZ = True

# ─── Static / Media ───────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-tenant-slug",
]

# ─── MinIO / S3 Storage ───────────────────────────────────────────────────────
MINIO_ENDPOINT = config("MINIO_ENDPOINT", default="minio:9000")
MINIO_ACCESS_KEY = config("MINIO_ACCESS_KEY", default="minioadmin")
MINIO_SECRET_KEY = config("MINIO_SECRET_KEY", default="minioadmin")
MINIO_BUCKET_NAME = config("MINIO_BUCKET_NAME", default="agamur")
MINIO_USE_HTTPS = config("MINIO_USE_HTTPS", default=False, cast=bool)
MINIO_EXTERNAL_ENDPOINT = config("MINIO_EXTERNAL_ENDPOINT", default="http://localhost:9000")

# ─── Celery ───────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://redis:6379/1")
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "django-cache"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ROUTES = {
    "apps.imports.tasks.*": {"queue": "imports"},
    "apps.reports.tasks.*": {"queue": "reports"},
}

# ─── Cache ────────────────────────────────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": config("REDIS_URL", default="redis://redis:6379/0"),
    }
}

# ─── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="AGAMUR <noreply@agamur.es>")

# ─── App Settings ─────────────────────────────────────────────────────────────
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")
TENANT_DOMAIN_SUFFIX = config("TENANT_DOMAIN_SUFFIX", default=".agamur.es")
PASSWORD_RESET_TIMEOUT = 86400  # 24 hours
