"""
Importación del Libro Genealógico histórico de AGAMUR desde Excel (LG ANC.xlsx).

Uso:
    python manage.py import_lg_agamur --excel /ruta/LG\ ANC.xlsx --tenant agamur

El slug del tenant se identifica con --tenant (ej. "agamur").
"""
import re
from datetime import date, timedelta, datetime as dt_datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.animals.models import Animal, MotivoBaja
from apps.accounts.models import Socio
from apps.tenants.models import Tenant

# ── Ganaderías excluidas (ya importadas en KRIA manualmente) ─────────────────
EXCLUDED_GANADERIAS = {"ANiC", "DMtnz", "SSR"}

# ── Mapeo ganadería → nombre_razon_social exacto en KRIA ────────────────────
GANADERIA_SOCIO: dict[str, str | None] = {
    "AABR": "Antonio Alicio Baños Ruiz",
    "ACM":  None,
    "ACV":  None,
    "ANH":  "Ángel Nieto Huertas",
    "ANiC": None,  # excluida
    "ASG":  None,
    "AVaE": "Antonio Valera Espin",
    "AVN":  "Antonio Vidal Nicolas",
    "AVQ":  None,
    "BNP":  "Blanca Navarro Polvorosa",
    "CSM":  "Cesareo Sánchez Moreno",
    "DAFE": None,
    "DAG":  "Diego Aroca García",
    "DEG":  "Daniel Egea García",
    "DMM":  None,
    "DMtnz": None,  # excluida
    "FFC":  None,
    "FJFL": "Francisco José Fustér Laguna",
    "FLM":  "Francisco José López Marco",
    "FMG":  None,
    "IDS":  "Ignacio Delgado Sánchez",
    "ISE":  "Iván Sánchez Esturillo",
    "JaCH": None,
    "JAPG": "José Antonio Peñalver Galindo",
    "JASB": "Jesús Ángel Serna Bernabéu",
    "JHG":  "Joaquín Hernández García",
    "JLM":  None,
    "JMMG": None,
    "JMRP": "Jose María Ros Piqueras",
    "LMM":  "Lorenzo Martínez Mendoza",
    "MCTG": "Maria Carmen Tomás García",
    "MEL":  None,
    "MGO":  "Mariano García Olivez",
    "MGP":  None,
    "NLN":  "Natalia Llorente Nosti",
    "PC":   "Agrícola y Ganadera Maipe, S.A. (Pedro Conesa)",
    "PGG":  "Pedro Gómez Gracia",
    "PJFS": None,
    "PRG":  None,
    "RJGR": None,
    "RMG":  "Raúl Martínez García",
    "RQB":  "Ramón Quiñonero Bravo",
    "SGG":  "Salvador Gambín Carmona",
    "SSR":  None,  # excluida
    "TER":  None,
    "UPCT": "Eva Armero Ibáñez",
}

# ── Helpers de fecha ─────────────────────────────────────────────────────────

EXCEL_EPOCH = date(1899, 12, 30)


def parse_date(val) -> date | None:
    """Convierte un valor de celda Excel a date.
    - datetime/date (openpyxl data_only) → directo
    - "R-xx/YY"  → 31/12/20(YY-1)
    - serial > 3000 → fecha Excel
    - entero 1900-2100 → 1 de enero de ese año
    - vacío / None → None
    """
    if val is None or val == "":
        return None

    # openpyxl con data_only=True devuelve datetime o date en celdas con formato fecha
    if isinstance(val, dt_datetime):
        return val.date()
    if isinstance(val, date):
        return val

    s = str(val).strip()
    if not s:
        return None

    # Formato R-xx/YY
    m = re.match(r"^R-\d+/(\d{2})$", s)
    if m:
        yy = int(m.group(1))
        year = 2000 + yy - 1
        return date(year, 12, 31)

    # Número
    try:
        n = float(s)
    except ValueError:
        return None

    if n > 3000:
        return EXCEL_EPOCH + timedelta(days=int(n))
    if 1900 <= n <= 2100:
        return date(int(n), 1, 1)
    return None


def parse_variedad(val) -> str:
    s = str(val).strip().upper() if val else ""
    if s == "SALMON":
        return Animal.Variedad.SALMON
    if s == "PLATA":
        return Animal.Variedad.PLATA
    return Animal.Variedad.SIN_DEFINIR


def parse_sexo(val) -> str:
    return Animal.Sexo.MACHO if str(val).strip() == "1" else Animal.Sexo.HEMBRA


class Command(BaseCommand):
    help = "Importa el LG histórico de AGAMUR desde Excel."

    def add_arguments(self, parser):
        parser.add_argument("--excel", required=True, help="Ruta al fichero LG ANC.xlsx")
        parser.add_argument("--tenant", required=True, help="Slug del tenant (ej. agamur)")
        parser.add_argument("--dry-run", action="store_true", help="Simula sin escribir en BD")

    def handle(self, *args, **options):
        try:
            import openpyxl
        except ImportError:
            raise CommandError("openpyxl no está instalado.")

        excel_path = options["excel"]
        tenant_slug = options["tenant"]
        dry_run = options["dry_run"]

        # ── Tenant ────────────────────────────────────────────────────────────
        try:
            tenant = Tenant.objects.get(slug=tenant_slug)
        except Tenant.DoesNotExist:
            raise CommandError(f"Tenant '{tenant_slug}' no encontrado.")
        self.stdout.write(f"Tenant: {tenant.name}")

        # ── Socios indexados por nombre_razon_social ──────────────────────────
        socios: dict[str, Socio] = {
            s.nombre_razon_social: s
            for s in Socio.all_objects.filter(tenant=tenant)
        }
        self.stdout.write(f"Socios cargados: {len(socios)}")

        # ── Motivos de baja (get_or_create) ───────────────────────────────────
        motivos_cache: dict[str, MotivoBaja] = {}

        def get_motivo(texto: str) -> MotivoBaja | None:
            if not texto:
                return None
            if texto not in motivos_cache:
                obj, _ = MotivoBaja.all_objects.get_or_create(
                    tenant=tenant, nombre=texto,
                    defaults={"is_active": True, "orden": 0},
                )
                motivos_cache[texto] = obj
            return motivos_cache[texto]

        # ── Leer Excel ────────────────────────────────────────────────────────
        self.stdout.write(f"Leyendo {excel_path}...")
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(min_row=2, values_only=True))
        wb.close()
        self.stdout.write(f"Filas leídas: {len(rows)}")

        # Índices de columna (0-based): A=0, B=1, C=2, D=3, E=4...
        COL = {c: i for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ")}
        COL.update({"AA": 26, "AB": 27, "AC": 28, "AD": 29, "AE": 30})

        def col(row, key):
            idx = COL[key]
            return row[idx] if idx < len(row) else None

        # ── Paso 1: crear animales ────────────────────────────────────────────
        # id_individual → Animal (para enlazar padre/madre en paso 2)
        id_to_animal: dict[str, Animal] = {}
        seen_ids: set[str] = set()

        created = skipped_excluded = skipped_dup = skipped_error = 0

        with transaction.atomic():
            for row_num, row in enumerate(rows, start=2):
                id_individual = str(col(row, "A") or "").strip()
                if not id_individual:
                    continue

                # Saltar duplicados (col A)
                if id_individual in seen_ids:
                    self.stdout.write(f"  [SKIP-DUP] fila {row_num} id={id_individual}")
                    skipped_dup += 1
                    continue
                seen_ids.add(id_individual)

                ganaderia_g = str(col(row, "G") or "").strip()

                # Saltar ganaderías excluidas
                if ganaderia_g in EXCLUDED_GANADERIAS:
                    skipped_excluded += 1
                    continue

                numero_anilla = str(col(row, "B") or "").strip()
                if not numero_anilla:
                    continue

                fecha_nacimiento = parse_date(col(row, "D"))
                if fecha_nacimiento is None:
                    self.stdout.write(f"  [SKIP-FECHA] fila {row_num} anilla={numero_anilla} sin fecha_nacimiento")
                    skipped_error += 1
                    continue

                sexo = parse_sexo(col(row, "E"))
                variedad = parse_variedad(col(row, "AE"))

                ganaderia_actual = str(col(row, "F") or "").strip()
                ganaderia_nacimiento = ganaderia_g

                fecha_incubacion = parse_date(col(row, "C"))

                # Estado
                presente = str(col(row, "K") or "").strip().upper()
                valoracion = col(row, "X")
                tiene_baja = str(col(row, "L") or "").strip() != ""

                if presente == "SI":
                    estado = Animal.Estado.EVALUADO if valoracion else Animal.Estado.APROBADO
                else:
                    estado = Animal.Estado.BAJA

                fecha_baja = parse_date(col(row, "L")) if estado == Animal.Estado.BAJA else None
                motivo_baja_texto = str(col(row, "M") or "").strip()
                motivo_baja = get_motivo(motivo_baja_texto) if fecha_baja else None

                # Histórico de ganaderías (cols G+H, I+J)
                # Cada entrada: {ganaderia, fecha_alta, fecha_baja}
                # La fecha_baja de gan1 = fecha_alta de gan2 (si existe)
                # La fecha_baja de gan2 = fecha_baja del animal (si está en baja)
                historico_ganaderias = []
                gan1 = str(col(row, "G") or "").strip()
                alta1 = parse_date(col(row, "H"))
                gan2 = str(col(row, "I") or "").strip()
                alta2 = parse_date(col(row, "J"))

                if gan1:
                    baja1 = alta2 if gan2 else (parse_date(col(row, "L")) if str(col(row, "K") or "").strip().upper() != "SI" else None)
                    historico_ganaderias.append({
                        "ganaderia": gan1,
                        "fecha_alta": alta1.isoformat() if alta1 else None,
                        "fecha_baja": baja1.isoformat() if baja1 else None,
                    })
                if gan2:
                    baja2 = parse_date(col(row, "L")) if str(col(row, "K") or "").strip().upper() != "SI" else None
                    historico_ganaderias.append({
                        "ganaderia": gan2,
                        "fecha_alta": alta2.isoformat() if alta2 else None,
                        "fecha_baja": baja2.isoformat() if baja2 else None,
                    })

                # Reproductor
                ad_val = str(col(row, "AD") or "").strip().upper()
                candidato_reproductor = ad_val == "SI"

                # Socio
                socio_nombre = GANADERIA_SOCIO.get(ganaderia_g)
                socio = socios.get(socio_nombre) if socio_nombre else None

                if not dry_run:
                    try:
                        animal, created_flag = Animal.all_objects.get_or_create(
                            tenant=tenant,
                            numero_anilla=numero_anilla,
                            fecha_nacimiento=fecha_nacimiento,
                            defaults={
                                "socio": socio,
                                "sexo": sexo,
                                "variedad": variedad,
                                "ganaderia_nacimiento": ganaderia_nacimiento,
                                "ganaderia_actual": ganaderia_actual,
                                "fecha_incubacion": fecha_incubacion,
                                "estado": estado,
                                "fecha_baja": fecha_baja,
                                "motivo_baja": motivo_baja,
                                "candidato_reproductor": candidato_reproductor,
                                "historico_ganaderias": historico_ganaderias,
                            },
                        )
                        id_to_animal[id_individual] = animal
                        if created_flag:
                            created += 1
                    except Exception as e:
                        self.stdout.write(f"  [ERROR] fila {row_num} anilla={numero_anilla}: {e}")
                        skipped_error += 1
                else:
                    self.stdout.write(
                        f"  [DRY] fila {row_num} anilla={numero_anilla} "
                        f"fecha={fecha_nacimiento} sexo={sexo} ganaderia={ganaderia_g} "
                        f"socio={socio_nombre or '-'} estado={estado}"
                    )
                    created += 1

            # ── Paso 2: enlazar padre / madre ─────────────────────────────────
            if not dry_run:
                self.stdout.write("Enlazando padre/madre...")
                linked_padre = linked_madre = 0

                for row_num, row in enumerate(rows, start=2):
                    id_individual = str(col(row, "A") or "").strip()
                    animal = id_to_animal.get(id_individual)
                    if not animal:
                        continue

                    padre_id = str(col(row, "O") or "").strip()
                    madre_id = str(col(row, "P") or "").strip()

                    updated = False
                    if padre_id and padre_id in id_to_animal:
                        animal.padre = id_to_animal[padre_id]
                        linked_padre += 1
                        updated = True
                    if madre_id and madre_id in id_to_animal:
                        animal.madre_animal = id_to_animal[madre_id]
                        linked_madre += 1
                        updated = True
                    if updated:
                        animal.save(update_fields=["padre", "madre_animal"])

                self.stdout.write(f"  Padres enlazados: {linked_padre}")
                self.stdout.write(f"  Madres enlazadas: {linked_madre}")

        self.stdout.write(self.style.SUCCESS(
            f"\nImportación completada:"
            f"\n  Creados:          {created}"
            f"\n  Excluidos (socio): {skipped_excluded}"
            f"\n  Duplicados:        {skipped_dup}"
            f"\n  Errores/skip:      {skipped_error}"
        ))
