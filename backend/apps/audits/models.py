"""
Auditorías de Socios — modelos configurables por tenant.

Flujo:
  1. SuperAdmin configura CriterioEvaluacion y PreguntaInstalacion por tenant.
  2. Gestión crea una AuditoriaSession para un socio.
  3. Por cada animal se crea AuditoriaAnimal con puntuaciones JSON.
  4. Para las instalaciones se crean AuditoriaRespuesta enlazadas a PreguntaInstalacion.
"""
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


# ── Configuración por tenant ───────────────────────────────────────────────────

class CriterioEvaluacion(UUIDModel):
    """Criterio morfológico evaluable (0–10) con multiplicador de peso."""

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="criterios_evaluacion",
        db_index=True,
    )
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, default="")
    # multiplicador: el resultado de cada criterio = valor(0-10) × multiplicador
    # La suma de (10 × multiplicador) de todos los criterios activos debe ser 100.
    multiplicador = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    is_active = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "audits_criterio_evaluacion"
        ordering = ["orden", "nombre"]
        verbose_name = "Criterio de Evaluación"
        verbose_name_plural = "Criterios de Evaluación"

    def __str__(self):
        return f"{self.nombre} (×{self.multiplicador})"


class PreguntaInstalacion(UUIDModel):
    """Pregunta del cuestionario de instalaciones, configurable por tenant."""

    class Tipo(models.TextChoices):
        SINO = "SINO", "Sí / No"
        TEXTO = "TEXTO", "Texto libre"
        PUNTUACION = "PUNTUACION", "Puntuación (0–10)"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="preguntas_instalacion",
        db_index=True,
    )
    texto = models.CharField(max_length=400)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.SINO)
    is_active = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "audits_pregunta_instalacion"
        ordering = ["orden"]
        verbose_name = "Pregunta de Instalación"
        verbose_name_plural = "Preguntas de Instalación"

    def __str__(self):
        return self.texto[:60]


# ── Sesión de auditoría ────────────────────────────────────────────────────────

class AuditoriaSession(UUIDModel):
    """Una visita de auditoría a las instalaciones de un socio."""

    class Estado(models.TextChoices):
        PLANIFICADA = "PLANIFICADA", "Planificada"
        EN_CURSO = "EN_CURSO", "En curso"
        COMPLETADA = "COMPLETADA", "Completada"
        CANCELADA = "CANCELADA", "Cancelada"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="auditorias",
        db_index=True,
    )
    socio = models.ForeignKey(
        "accounts.Socio",
        on_delete=models.PROTECT,
        related_name="auditorias",
    )
    fecha_planificada = models.DateField()
    fecha_realizacion = models.DateField(null=True, blank=True)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PLANIFICADA
    )
    auditores = models.TextField(blank=True, default="")  # nombres libres
    notas_generales = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="auditorias_creadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "audits_auditoria_session"
        ordering = ["-fecha_planificada"]
        verbose_name = "Auditoría"
        verbose_name_plural = "Auditorías"

    def __str__(self):
        return f"Auditoría {self.socio} — {self.fecha_planificada}"


# ── Evaluación de animal dentro de una auditoría ──────────────────────────────

class AuditoriaAnimal(UUIDModel):
    """Puntuaciones de un animal evaluado durante una auditoría."""

    auditoria = models.ForeignKey(
        AuditoriaSession,
        on_delete=models.CASCADE,
        related_name="animales_evaluados",
    )
    animal = models.ForeignKey(
        "animals.Animal",
        on_delete=models.PROTECT,
        related_name="auditorias_evaluacion",
        null=True,
        blank=True,
    )
    # Para el caso en que se da de alta el animal durante la auditoría
    # y todavía no tiene PK (uso interno), o simplemente para identificación libre:
    numero_anilla_manual = models.CharField(max_length=50, blank=True, default="")

    # {criterio_id (str): valor (int 0-10)}
    puntuaciones = models.JSONField(default=dict)
    # Calculado en save(): sum(valor × multiplicador) para criterios activos
    puntuacion_total = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    # Puntuación máxima posible en el momento del cálculo
    puntuacion_maxima = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))

    notas = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audits_auditoria_animal"
        verbose_name = "Animal Auditado"
        verbose_name_plural = "Animales Auditados"
        unique_together = [("auditoria", "animal")]

    def recalcular_puntuacion(self):
        """Recalcula puntuacion_total y puntuacion_maxima según los criterios activos del tenant."""
        criterios = CriterioEvaluacion.objects.filter(
            tenant=self.auditoria.tenant, is_active=True
        )
        total = Decimal("0")
        maxima = Decimal("0")
        for c in criterios:
            valor = self.puntuaciones.get(str(c.id), 0)
            total += Decimal(str(valor)) * c.multiplicador
            maxima += Decimal("10") * c.multiplicador
        self.puntuacion_total = total
        self.puntuacion_maxima = maxima

    def save(self, *args, **kwargs):
        self.recalcular_puntuacion()
        super().save(*args, **kwargs)

    def __str__(self):
        label = self.animal.numero_anilla if self.animal else self.numero_anilla_manual or "—"
        return f"{label} — {self.puntuacion_total}/{self.puntuacion_maxima}"


# ── Respuestas al cuestionario de instalaciones ───────────────────────────────

class AuditoriaRespuesta(UUIDModel):
    """Respuesta a una pregunta de instalaciones dentro de una auditoría."""

    auditoria = models.ForeignKey(
        AuditoriaSession,
        on_delete=models.CASCADE,
        related_name="respuestas_instalacion",
    )
    pregunta = models.ForeignKey(
        PreguntaInstalacion,
        on_delete=models.PROTECT,
        related_name="respuestas",
    )
    respuesta = models.CharField(max_length=1000, blank=True, default="")

    class Meta:
        db_table = "audits_auditoria_respuesta"
        unique_together = [("auditoria", "pregunta")]
        verbose_name = "Respuesta de Instalación"

    def __str__(self):
        return f"{self.pregunta.texto[:40]} → {self.respuesta[:40]}"
