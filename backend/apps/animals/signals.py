"""
Animal signals:
  pre_save  — revert APROBADO/EVALUADO → MODIFICADO if socio edits
  (SOCIO_EN_BAJA transition is handled by a Celery task, not a signal)
"""
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Animal


@receiver(pre_save, sender=Animal)
def revert_state_on_socio_edit(sender, instance, **kwargs):
    """
    If a socio (non-gestión) is saving an APROBADO or EVALUADO animal,
    revert its state to REGISTRADO.

    We detect "socio edit" by checking the _editing_user attribute
    set by the view/serializer before calling save().
    """
    if not instance.pk:
        return  # new animal, nothing to revert

    editing_user = getattr(instance, "_editing_user", None)
    if editing_user is None:
        return  # system/task edit — no revert

    if editing_user.is_gestion or editing_user.is_superadmin:
        return  # gestión edit — no revert

    LOCKED_STATES = {Animal.Estado.APROBADO, Animal.Estado.EVALUADO}
    try:
        old = Animal.all_objects.get(pk=instance.pk)
    except Animal.DoesNotExist:
        return

    if old.estado in LOCKED_STATES:
        instance.estado = Animal.Estado.MODIFICADO
