"""
Celery tasks for the animals app.
"""
from celery import shared_task


@shared_task(name="animals.freeze_animals_for_socio", queue="default")
def freeze_animals_for_socio(socio_id: str):
    """
    Called when a Socio is set to BAJA.
    Freezes all active animals of that socio to SOCIO_EN_BAJA.
    """
    from .models import Animal

    updated = Animal.all_objects.filter(
        socio_id=socio_id,
    ).exclude(
        estado=Animal.Estado.SOCIO_EN_BAJA,
    ).update(estado=Animal.Estado.SOCIO_EN_BAJA)

    return {"updated": updated, "socio_id": socio_id}
