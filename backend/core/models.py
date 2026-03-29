"""
Abstract base model that adds tenant FK + TenantManager to every model.
"""
import uuid

from django.db import models

from .managers import TenantManager


class TenantAwareModel(models.Model):
    """
    Every domain model must inherit this.
    Adds:
      - tenant FK  (non-nullable, indexed)
      - TenantManager as default manager
      - all_objects unfiltered manager
    """

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="+",
        db_index=True,
    )

    objects = TenantManager()
    all_objects = models.Manager()  # bypass tenant filter (admin / smart-reg)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True
