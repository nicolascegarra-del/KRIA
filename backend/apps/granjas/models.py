"""
Granja model — farm belonging to a Socio within a Tenant.
"""
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class Granja(UUIDModel):
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        db_index=True,
    )
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.CASCADE,
        related_name="granjas",
    )
    nombre = models.CharField(max_length=200)
    codigo_rega = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "granjas_granja"
        unique_together = [("tenant", "socio", "nombre")]
        verbose_name = "Granja"
        verbose_name_plural = "Granjas"
        indexes = [
            models.Index(fields=["tenant", "socio"]),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.socio})"
