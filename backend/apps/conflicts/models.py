import uuid
from django.db import models
from core.managers import TenantManager
from core.models import UUIDModel


class Conflicto(UUIDModel):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        RESUELTO = "RESUELTO", "Resuelto"
        DESCARTADO = "DESCARTADO", "Descartado"

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="conflictos", db_index=True
    )
    numero_anilla = models.CharField(max_length=100)
    anio_nacimiento = models.PositiveSmallIntegerField()
    socio_reclamante = models.ForeignKey(
        "accounts.Socio", on_delete=models.CASCADE, related_name="conflictos_reclamante"
    )
    socio_actual = models.ForeignKey(
        "accounts.Socio", on_delete=models.CASCADE, related_name="conflictos_actual"
    )
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    notas = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "conflicts_conflicto"
        verbose_name = "Conflicto"
        verbose_name_plural = "Conflictos"

    def __str__(self):
        return f"{self.numero_anilla}/{self.anio_nacimiento} — {self.estado}"
