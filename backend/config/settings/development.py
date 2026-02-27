from .base import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

# Use console email in development
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Relaxed JWT for dev
from datetime import timedelta
SIMPLE_JWT = {
    **SIMPLE_JWT,  # type: ignore[name-defined]  # noqa
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
}

# Django Debug Toolbar (optional, install separately)
INTERNAL_IPS = ["127.0.0.1"]

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
