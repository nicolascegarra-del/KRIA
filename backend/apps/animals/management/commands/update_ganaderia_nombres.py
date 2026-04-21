"""
Actualiza historico_ganaderias en todos los animales del tenant indicado,
reemplazando las siglas de ganadería por el nombre_razon_social del socio
propietario según el mapeo conocido. Las ganaderías sin mapeo quedan como
"Ganadería desconocida".

Uso:
    python manage.py update_ganaderia_nombres --tenant agamur
    python manage.py update_ganaderia_nombres --tenant agamur --dry-run
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

GANADERIA_TO_NOMBRE: dict[str, str] = {
    "AABR": "Antonio Alicio Baños Ruiz",
    "ANH":  "Ángel Nieto Huertas",
    "ANiC": "Ganadería ANiC",
    "AVaE": "Antonio Valera Espin",
    "AVAE": "Antonio Valera Espin",
    "AVN":  "Antonio Vidal Nicolas",
    "BNP":  "Blanca Navarro Polvorosa",
    "CSM":  "Cesareo Sánchez Moreno",
    "DAG":  "Diego Aroca García",
    "DEG":  "Daniel Egea García",
    "DMtnz": "Ganadería DMtnz",
    "FJFL": "Francisco José Fustér Laguna",
    "FLM":  "Francisco José López Marco",
    "IDS":  "Ignacio Delgado Sánchez",
    "ISE":  "Iván Sánchez Esturillo",
    "JAPG": "José Antonio Peñalver Galindo",
    "JASB": "Jesús Ángel Serna Bernabéu",
    "JHG":  "Joaquín Hernández García",
    "JMRP": "Jose María Ros Piqueras",
    "LMM":  "Lorenzo Martínez Mendoza",
    "MCTG": "Maria Carmen Tomás García",
    "MGO":  "Mariano García Olivez",
    "NLN":  "Natalia Llorente Nosti",
    "PC":   "Agrícola y Ganadera Maipe, S.A. (Pedro Conesa)",
    "PGG":  "Pedro Gómez Gracia",
    "RMG":  "Raúl Martínez García",
    "RQB":  "Ramón Quiñonero Bravo",
    "SGG":  "Salvador Gambín Carmona",
    "SSR":  "Ganadería SSR",
    "UPCT": "Eva Armero Ibáñez",
}

UNKNOWN_LABEL = "Ganadería desconocida"


class Command(BaseCommand):
    help = "Actualiza historico_ganaderias reemplazando siglas por nombres completos."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="Slug del tenant")
        parser.add_argument("--dry-run", action="store_true", help="Simula sin guardar")

    def handle(self, *args, **options):
        from apps.animals.models import Animal
        from apps.tenants.models import Tenant

        try:
            tenant = Tenant.objects.get(slug=options["tenant"])
        except Tenant.DoesNotExist:
            raise CommandError(f"Tenant '{options['tenant']}' no encontrado.")

        dry_run = options["dry_run"]
        updated = skipped = unchanged = 0

        with transaction.atomic():
            for animal in Animal.all_objects.filter(tenant=tenant).exclude(historico_ganaderias=[]):
                if not animal.historico_ganaderias:
                    skipped += 1
                    continue

                changed = False
                for entry in animal.historico_ganaderias:
                    gan = entry.get("ganaderia", "")
                    if not gan:
                        continue
                    nombre = GANADERIA_TO_NOMBRE.get(gan)
                    if nombre and nombre != gan:
                        if dry_run:
                            self.stdout.write(f"  [DRY] {animal.numero_anilla}: '{gan}' → '{nombre}'")
                        entry["ganaderia"] = nombre
                        changed = True
                    elif not nombre and gan not in ("Ganadería desconocida", UNKNOWN_LABEL):
                        # Unknown abbreviation — only label if it looks like an abbreviation (all caps/short)
                        if len(gan) <= 6 and gan.upper() == gan:
                            if dry_run:
                                self.stdout.write(f"  [DRY] {animal.numero_anilla}: '{gan}' → '{UNKNOWN_LABEL}'")
                            entry["ganaderia"] = UNKNOWN_LABEL
                            changed = True

                if changed:
                    if not dry_run:
                        animal.save(update_fields=["historico_ganaderias"])
                    updated += 1
                else:
                    unchanged += 1

            if dry_run:
                self.stdout.write("[DRY RUN] No se guardaron cambios.")

        self.stdout.write(self.style.SUCCESS(
            f"\nResultado:\n  Actualizados: {updated}\n  Sin cambios: {unchanged}\n  Sin historial: {skipped}"
        ))
