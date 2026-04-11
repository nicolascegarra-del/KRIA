"""
Management command: retroactively set estado=EVALUADO for animals
that have at least one completed audit (AuditoriaSession COMPLETADA)
but are still in APROBADO state.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Retroactively mark as EVALUADO animals with a completed audit still in APROBADO state."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many animals would be updated without making changes.",
        )

    def handle(self, *args, **options):
        from apps.audits.models import AuditoriaAnimal
        from apps.animals.models import Animal

        animal_ids = (
            AuditoriaAnimal.objects
            .filter(
                auditoria__estado="COMPLETADA",
                animal__isnull=False,
            )
            .values_list("animal_id", flat=True)
            .distinct()
        )

        qs = Animal.all_objects.filter(
            pk__in=animal_ids,
            estado=Animal.Estado.APROBADO,
        )

        count = qs.count()

        if options["dry_run"]:
            self.stdout.write(f"[dry-run] {count} animals would be updated to EVALUADO.")
            return

        with transaction.atomic():
            updated = qs.update(estado=Animal.Estado.EVALUADO)

        self.stdout.write(self.style.SUCCESS(f"Updated {updated} animals → EVALUADO."))
