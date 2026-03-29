"""
Documento — repositorio general y buzón particular por socio.
"""
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class Documento(UUIDModel):
    class Tipo(models.TextChoices):
        GENERAL = "GENERAL", "General (Junta)"
        PARTICULAR = "PARTICULAR", "Particular (Socio)"

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="documentos", db_index=True
    )
    tipo = models.CharField(max_length=12, choices=Tipo.choices)
    # Null → documento GENERAL; FK → documento PARTICULAR de ese socio
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="documentos",
    )
    nombre_archivo = models.CharField(max_length=255)
    file_key = models.CharField(max_length=500)      # MinIO object key
    content_type = models.CharField(max_length=100)
    tamanio_bytes = models.PositiveIntegerField()
    subido_por = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="documentos_subidos",
    )
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "documentos_documento"
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nombre_archivo} v{self.version} ({self.tipo})"
