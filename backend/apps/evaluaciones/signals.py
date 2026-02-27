"""Post-save signal: after evaluation saved → animal.estado = EVALUADO."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Evaluacion


@receiver(post_save, sender=Evaluacion)
def on_evaluacion_saved(sender, instance, **kwargs):
    from apps.animals.models import Animal
    animal = instance.animal
    if animal.estado != Animal.Estado.EVALUADO:
        animal.estado = Animal.Estado.EVALUADO
        animal.save(update_fields=["estado"])
