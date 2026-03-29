"""
Evaluacion model — 6-field morphological scoring with auto-calculated mean.
"""
import uuid
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel

SCORE_VALIDATORS = [MinValueValidator(1), MaxValueValidator(10)]


class Evaluacion(UUIDModel):
    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="evaluaciones", db_index=True
    )
    animal = models.OneToOneField(
        "animals.Animal", on_delete=models.CASCADE, related_name="evaluacion"
    )
    evaluador = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="evaluaciones"
    )

    # 6 morphological fields (1–10)
    cabeza = models.SmallIntegerField(validators=SCORE_VALIDATORS)
    cola = models.SmallIntegerField(validators=SCORE_VALIDATORS)
    pecho_abdomen = models.SmallIntegerField(validators=SCORE_VALIDATORS)
    muslos_tarsos = models.SmallIntegerField(validators=SCORE_VALIDATORS)
    cresta_babilla = models.SmallIntegerField(validators=SCORE_VALIDATORS)
    color = models.SmallIntegerField(validators=SCORE_VALIDATORS)

    puntuacion_media = models.DecimalField(max_digits=4, decimal_places=2, editable=False, default=0)

    # Observaciones morfológicas adicionales
    picos_cresta = models.CharField(max_length=100, blank=True, default="")
    color_orejilla = models.CharField(max_length=100, blank=True, default="")
    color_general = models.CharField(max_length=100, blank=True, default="")
    peso_evaluacion = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    variedad_confirmada = models.CharField(
        max_length=20,
        choices=[("SALMON", "Salmón"), ("PLATA", "Plata"), ("OTRA", "Otra")],
        null=True,
        blank=True,
    )

    notas = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "evaluaciones_evaluacion"
        verbose_name = "Evaluación"
        verbose_name_plural = "Evaluaciones"

    def __str__(self):
        return f"Eval {self.animal} — {self.puntuacion_media}"

    def save(self, *args, **kwargs):
        fields = [self.cabeza, self.cola, self.pecho_abdomen, self.muslos_tarsos, self.cresta_babilla, self.color]
        self.puntuacion_media = Decimal(sum(fields)) / Decimal("6.0")
        super().save(*args, **kwargs)
