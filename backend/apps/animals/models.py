"""
Animal model with state machine and genealogy links.
"""
import uuid

from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class Animal(UUIDModel):
    class Estado(models.TextChoices):
        AÑADIDO = "AÑADIDO", "Añadido"
        APROBADO = "APROBADO", "Aprobado"
        EVALUADO = "EVALUADO", "Evaluado"
        RECHAZADO = "RECHAZADO", "Rechazado"
        SOCIO_EN_BAJA = "SOCIO_EN_BAJA", "Socio en baja"

    class Sexo(models.TextChoices):
        MACHO = "M", "Macho"
        HEMBRA = "H", "Hembra"

    class Variedad(models.TextChoices):
        SALMON = "SALMON", "Salmón"
        PLATA = "PLATA", "Plata"
        OTRA = "OTRA", "Otra"

    # Tenant + Socio
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="animals",
        db_index=True,
    )
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.CASCADE,
        related_name="animals",
    )

    # Identification (unique within tenant)
    numero_anilla = models.CharField(max_length=100)
    anio_nacimiento = models.PositiveSmallIntegerField()

    # Biological data
    sexo = models.CharField(max_length=1, choices=Sexo.choices)
    variedad = models.CharField(max_length=20, choices=Variedad.choices, default=Variedad.SALMON)

    # Genealogy
    padre = models.ForeignKey(
        "self",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="hijos_padre",
    )
    madre_animal = models.ForeignKey(
        "self",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="hijos_madre",
    )
    madre_lote = models.ForeignKey(
        "lotes.Lote",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="crias",
    )

    # Media + history (JSONB)
    fotos = models.JSONField(default=list, blank=True)
    historico_pesos = models.JSONField(default=list, blank=True)

    # State machine
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.AÑADIDO)
    razon_rechazo = models.TextField(blank=True, default="")

    # Reproductor flags
    candidato_reproductor = models.BooleanField(default=False)
    reproductor_aprobado = models.BooleanField(default=False)

    # Alerta de anilla (computed on save, non-blocking warning except for APROBADO transition)
    # "" = sin alerta, "FUERA_RANGO" = fuera del rango asignado, "DIAMETRO" = diámetro no corresponde al sexo
    alerta_anilla = models.CharField(max_length=20, blank=True, default="")

    # Breeding data
    fecha_incubacion = models.DateField(null=True, blank=True)
    ganaderia_nacimiento = models.CharField(max_length=200, blank=True, default="")
    ganaderia_actual = models.CharField(max_length=200, blank=True, default="")

    # Farm
    granja = models.ForeignKey(
        "granjas.Granja",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="animales",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "animals_animal"
        unique_together = [("tenant", "numero_anilla", "anio_nacimiento")]
        verbose_name = "Animal"
        verbose_name_plural = "Animales"
        indexes = [
            models.Index(fields=["tenant", "socio"]),
            models.Index(fields=["tenant", "estado"]),
            models.Index(fields=["tenant", "variedad"]),
        ]

    def __str__(self):
        return f"{self.numero_anilla}/{self.anio_nacimiento} ({self.get_sexo_display()})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.madre_animal_id and self.madre_lote_id:
            raise ValidationError("madre_animal and madre_lote are mutually exclusive.")
