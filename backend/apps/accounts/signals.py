"""
Signal: when a Socio is set to BAJA, enqueue a Celery task
to freeze all their animals to SOCIO_EN_BAJA state.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Socio


@receiver(post_save, sender=Socio)
def on_socio_saved(sender, instance, created, **kwargs):
    if not created and instance.estado == Socio.Estado.BAJA:
        # Import here to avoid circular import
        from apps.animals.tasks import freeze_animals_for_socio
        freeze_animals_for_socio.delay(str(instance.id))
