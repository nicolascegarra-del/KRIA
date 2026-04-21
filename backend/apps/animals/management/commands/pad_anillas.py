"""
Pads all numero_anilla values to 5 digits with leading zeros.
Only processes anillas that are purely numeric and shorter than 5 digits.

Usage:
    python manage.py pad_anillas --dry-run          # preview changes
    python manage.py pad_anillas                    # apply changes
    python manage.py pad_anillas --tenant agamur    # single tenant
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Pad numeric numero_anilla values to 5 digits with leading zeros"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--tenant", default=None)

    def handle(self, *args, **options):
        from apps.animals.models import Animal

        dry_run = options["dry_run"]
        tenant_slug = options["tenant"]

        qs = Animal.all_objects.all()
        if tenant_slug:
            qs = qs.filter(tenant__slug=tenant_slug)

        # Only animals whose anilla is purely numeric and shorter than 5 digits
        to_update = [
            a for a in qs.only("id", "tenant_id", "numero_anilla", "fecha_nacimiento")
            if a.numero_anilla.isdigit() and len(a.numero_anilla) < 5
        ]

        self.stdout.write(f"Animales a actualizar: {len(to_update)}")

        if not to_update:
            self.stdout.write("Nada que hacer.")
            return

        # Check for unique_together conflicts before applying
        conflicts = []
        existing = set(
            Animal.all_objects.values_list("tenant_id", "numero_anilla", "fecha_nacimiento")
        )
        for a in to_update:
            padded = a.numero_anilla.zfill(5)
            key = (a.tenant_id, padded, a.fecha_nacimiento)
            if key in existing:
                conflicts.append(f"  CONFLICTO: {a.numero_anilla} → {padded} (tenant={a.tenant_id}, fecha={a.fecha_nacimiento})")

        if conflicts:
            self.stdout.write(self.style.ERROR("Conflictos detectados (ya existen anillas con ese valor padded):"))
            for c in conflicts:
                self.stdout.write(self.style.ERROR(c))
            self.stdout.write(self.style.ERROR("Abortando. Resuelve los conflictos antes de continuar."))
            return

        # Preview first 20 changes
        self.stdout.write("\nPrimeras 20 transformaciones:")
        for a in to_update[:20]:
            self.stdout.write(f"  {a.numero_anilla!r:>8} → {a.numero_anilla.zfill(5)!r}")
        if len(to_update) > 20:
            self.stdout.write(f"  ... y {len(to_update) - 20} más")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY-RUN] No se aplicaron cambios."))
            return

        # Apply
        updated = 0
        with transaction.atomic():
            for a in to_update:
                a.numero_anilla = a.numero_anilla.zfill(5)
                a.save(update_fields=["numero_anilla"])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"\nActualizados: {updated} animales."))
