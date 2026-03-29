"""
TenantQuerySet / TenantManager — auto-filter every queryset by current tenant.
The active tenant is stored in a thread-local set by TenantMiddleware.
"""
import threading

from django.db import models

_thread_locals = threading.local()


def get_current_tenant():
    return getattr(_thread_locals, "tenant", None)


def set_current_tenant(tenant):
    _thread_locals.tenant = tenant


def clear_current_tenant():
    _thread_locals.tenant = None


class TenantQuerySet(models.QuerySet):
    def for_tenant(self, tenant):
        return self.filter(tenant=tenant)


class TenantManager(models.Manager):
    def get_queryset(self):
        qs = TenantQuerySet(self.model, using=self._db)
        tenant = get_current_tenant()
        if tenant is not None:
            return qs.filter(tenant=tenant)
        return qs

    def for_tenant(self, tenant):
        return TenantQuerySet(self.model, using=self._db).filter(tenant=tenant)
