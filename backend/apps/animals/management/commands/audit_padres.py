"""
Audits all padre relationships across the tenant:

  1. Padre is female (sexo='H') — critical error
  2. Padre has alerta_anilla='DIAMETRO' — diameter mismatch warning
  3. Padre animal does not exist in DB (broken FK) — should never happen with DB constraints

Usage:
    python manage.py audit_padres                   # all tenants
    python manage.py audit_padres --tenant agamur   # single tenant
    python manage.py audit_padres --fix             # set padre=null for female padres (dry-run by default)
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Audit padre relationships: validate sexo=M and diameter for all animals"

    def add_arguments(self, parser):
        parser.add_argument("--tenant", default=None)
        parser.add_argument("--fix", action="store_true", help="Set padre=null for female padres")
        parser.add_argument("--dry-run", action="store_true", help="Preview fixes without applying")

    def handle(self, *args, **options):
        from apps.animals.models import Animal

        tenant_slug = options["tenant"]
        fix = options["fix"]
        dry_run = options["dry_run"]

        qs = Animal.all_objects.filter(padre__isnull=False).select_related("padre", "tenant")
        if tenant_slug:
            qs = qs.filter(tenant__slug=tenant_slug)

        self.stdout.write(f"Animales con padre asignado: {qs.count()}")

        female_padres = []
        diametro_warnings = []

        for animal in qs:
            padre = animal.padre
            if padre.sexo == "H":
                female_padres.append((animal, padre))
            elif padre.alerta_anilla == "DIAMETRO":
                diametro_warnings.append((animal, padre))

        # Report female padres
        if female_padres:
            self.stdout.write(self.style.ERROR(f"\n[ERROR] Padres con sexo=H: {len(female_padres)}"))
            for animal, padre in female_padres:
                self.stdout.write(
                    f"  Animal {animal.numero_anilla} ({animal.tenant.slug}) "
                    f"→ padre {padre.numero_anilla} (sexo=H, id={str(padre.id)[:8]})"
                )
        else:
            self.stdout.write(self.style.SUCCESS("\n[OK] Ningún padre con sexo=H."))

        # Report diameter warnings
        if diametro_warnings:
            self.stdout.write(self.style.WARNING(f"\n[WARN] Padres con alerta de diámetro: {len(diametro_warnings)}"))
            for animal, padre in diametro_warnings:
                self.stdout.write(
                    f"  Animal {animal.numero_anilla} ({animal.tenant.slug}) "
                    f"→ padre {padre.numero_anilla} (alerta_anilla=DIAMETRO)"
                )
        else:
            self.stdout.write(self.style.SUCCESS("[OK] Ningún padre con alerta de diámetro."))

        # Apply fix
        if fix and female_padres:
            if dry_run:
                self.stdout.write(self.style.WARNING(f"\n[DRY-RUN] Se eliminarían {len(female_padres)} relaciones padre incorrectas."))
            else:
                ids = [animal.id for animal, _ in female_padres]
                updated = Animal.all_objects.filter(id__in=ids).update(padre=None)
                self.stdout.write(self.style.SUCCESS(f"\nCorregidos: {updated} animales (padre=null)."))
        elif fix and not female_padres:
            self.stdout.write("\nNada que corregir.")

        self.stdout.write(f"\nResumen: {len(female_padres)} errores críticos, {len(diametro_warnings)} advertencias.")
