"""Post-save signal: after evaluation saved → animal.estado = EVALUADO + sync variedad."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Evaluacion


@receiver(post_save, sender=Evaluacion)
def on_evaluacion_saved(sender, instance, **kwargs):
    from apps.animals.models import Animal
    animal = instance.animal
    update_fields = []

    if animal.estado != Animal.Estado.EVALUADO:
        animal.estado = Animal.Estado.EVALUADO
        update_fields.append("estado")

    # Si el técnico confirmó la variedad, copiarla al animal
    if instance.variedad_confirmada and animal.variedad != instance.variedad_confirmada:
        animal.variedad = instance.variedad_confirmada
        update_fields.append("variedad")

    if update_fields:
        animal.save(update_fields=update_fields)
