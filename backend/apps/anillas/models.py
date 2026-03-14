"""
EntregaAnillas — rangos de anillas asignados por la Junta a cada socio por campaña.
Diámetro 18mm → Hembra, 20mm → Macho.
"""
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class EntregaAnillas(UUIDModel):
    class Diametro(models.TextChoices):
        MM_18 = "18", "18 mm (Hembra)"
        MM_20 = "20", "20 mm (Macho)"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="entregas_anillas",
        db_index=True,
    )
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.CASCADE,
        related_name="entregas_anillas",
    )
    anio_campana = models.PositiveSmallIntegerField(
        help_text="Año de campaña al que corresponde el rango (ej. 2024)."
    )
    rango_inicio = models.CharField(
        max_length=50,
        help_text="Primer número de anilla del rango asignado.",
    )
    rango_fin = models.CharField(
        max_length=50,
        help_text="Último número de anilla del rango asignado.",
    )
    diametro = models.CharField(
        max_length=2,
        choices=Diametro.choices,
        help_text="18 mm para hembras, 20 mm para machos.",
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entregas_anillas_creadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "anillas_entregaanillas"
        verbose_name = "Entrega de Anillas"
        verbose_name_plural = "Entregas de Anillas"
        ordering = ["-anio_campana", "socio"]

    def __str__(self):
        return (
            f"{self.socio} — {self.anio_campana} — "
            f"{self.rango_inicio}–{self.rango_fin} (∅{self.diametro}mm)"
        )
