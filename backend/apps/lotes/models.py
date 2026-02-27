import uuid
from django.db import models
from core.managers import TenantManager
from core.models import UUIDModel


class Lote(UUIDModel):
    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="lotes", db_index=True
    )
    socio = models.ForeignKey(
        "accounts.Socio", on_delete=models.CASCADE, related_name="lotes"
    )
    nombre = models.CharField(max_length=200)
    macho = models.ForeignKey(
        "animals.Animal",
        on_delete=models.SET_NULL,
        null=True,
        related_name="lotes_como_macho",
        limit_choices_to={"sexo": "M"},
    )
    hembras = models.ManyToManyField(
        "animals.Animal",
        related_name="lotes_como_hembra",
        blank=True,
        through="LoteHembra",
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "lotes_lote"
        verbose_name = "Lote de Cría"
        verbose_name_plural = "Lotes de Cría"

    def __str__(self):
        return f"{self.nombre} ({self.socio})"


class LoteHembra(models.Model):
    lote = models.ForeignKey(Lote, on_delete=models.CASCADE)
    hembra = models.ForeignKey(
        "animals.Animal", on_delete=models.CASCADE, limit_choices_to={"sexo": "H"}
    )

    class Meta:
        db_table = "lotes_lote_hembras"
        unique_together = [("lote", "hembra")]
