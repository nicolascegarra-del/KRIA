"""
Módulo TABLAS — tablas de control personalizadas por asociación.

Flujo:
  1. La asociación crea una TablaControl (nombre + columnas de socio + columnas de control).
  2. Al crear la tabla se generan automáticamente TablaEntrada por cada socio del tenant.
  3. La gestión edita los valores de cada entrada directamente en la tabla.
  4. La tabla se puede exportar a PDF o Excel.
"""
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class TablaControl(UUIDModel):
    """Definición de una tabla de control creada por la asociación."""

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="tablas_control",
        db_index=True,
    )
    nombre = models.CharField(max_length=200)
    # Lista de campos del Socio a mostrar como columnas informativas.
    # Ej: ["numero_socio", "nombre_razon_social", "dni_nif", "telefono"]
    socio_columns = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "tablas_tabla_control"
        ordering = ["-created_at"]
        verbose_name = "Tabla de Control"
        verbose_name_plural = "Tablas de Control"

    def __str__(self):
        return f"{self.nombre} [{self.tenant.slug}]"


class TablaColumna(UUIDModel):
    """Columna de control personalizada dentro de una TablaControl."""

    class Tipo(models.TextChoices):
        CHECKBOX = "CHECKBOX", "Casilla (Sí/No)"
        TEXT = "TEXT", "Texto libre"
        DATE = "DATE", "Fecha"
        NUMBER = "NUMBER", "Número"

    tabla = models.ForeignKey(
        TablaControl,
        on_delete=models.CASCADE,
        related_name="columnas",
    )
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.CHECKBOX)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "tablas_columna"
        ordering = ["orden", "nombre"]
        verbose_name = "Columna de Control"
        verbose_name_plural = "Columnas de Control"

    def __str__(self):
        return f"{self.tabla.nombre} › {self.nombre} ({self.tipo})"


class TablaEntrada(UUIDModel):
    """Fila de la tabla: valores de control para un socio concreto."""

    tabla = models.ForeignKey(
        TablaControl,
        on_delete=models.CASCADE,
        related_name="entradas",
    )
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.CASCADE,
        related_name="tablas_entradas",
    )
    # {columna_id (str): valor}
    # Checkbox → True/False, Text → str, Date → "YYYY-MM-DD", Number → numeric str
    valores = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tablas_entrada"
        unique_together = [("tabla", "socio")]
        verbose_name = "Entrada de Tabla"
        verbose_name_plural = "Entradas de Tabla"

    def __str__(self):
        return f"{self.tabla.nombre} › {self.socio}"
