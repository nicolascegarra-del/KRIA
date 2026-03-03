"""
Settings for the test suite — completely standalone (SQLite + no Redis).
"""
from .development import *  # noqa

# ── SQLite en memoria: sin necesidad de PostgreSQL ────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# ── Cache: memoria local (sin Redis) ──────────────────────────────────────────
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# ── Celery: modo síncrono para que las tasks se ejecuten en el mismo proceso ──
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_RESULT_BACKEND = "cache"
CELERY_CACHE_BACKEND = "memory"

# ── Email: capturar correos en memoria (no enviamos emails en tests) ──────────
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# ── Contraseñas: hasher rápido para que los tests no sean lentos ──────────────
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# ── Sin throttling en tests ───────────────────────────────────────────────────
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]  # noqa
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "9999/min",
        "user": "9999/min",
        "uploads": "9999/min",
    },
}

# ── JWT: tokens más largos para no tener que refrescar en tests ───────────────
from datetime import timedelta
SIMPLE_JWT = {
    **SIMPLE_JWT,  # type: ignore[name-defined]  # noqa
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
}

# ── Storages: sin django-storages (sin S3) ────────────────────────────────────
# Usamos FileSystemStorage local para tests (los tests mockean MinIO donde hace falta)
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
