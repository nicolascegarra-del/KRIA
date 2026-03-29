"""
Celery task: import socios from Excel using Pandas UPSERT.

Expected columns (case-insensitive):
  dni_nif | nombre_razon_social | email | first_name | last_name |
  telefono | direccion | numero_socio | codigo_rega
"""
import io
import logging
import traceback
from datetime import timezone as dt_timezone

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="imports.process_import_job", queue="imports", bind=True, max_retries=0)
def process_import_job(self, job_id: str):
    from .models import ImportJob
    from apps.accounts.models import Socio, User
    from apps.tenants.models import Tenant

    try:
        job = ImportJob.all_objects.select_related("tenant").get(pk=job_id)
    except ImportJob.DoesNotExist:
        logger.error(f"ImportJob {job_id} not found.")
        return

    job.status = ImportJob.Status.PROCESSING
    job.save(update_fields=["status"])

    tenant = job.tenant

    try:
        import pandas as pd
        from apps.reports.storage import get_minio_client

        client = get_minio_client()
        bucket = __import__("django.conf", fromlist=["settings"]).settings.MINIO_BUCKET_NAME
        response = client.get_object(bucket, job.file_key)
        file_bytes = response.read()
        response.close()

        df = pd.read_excel(io.BytesIO(file_bytes), dtype=str)
        df.columns = [c.strip().lower() for c in df.columns]

        required = {"dni_nif", "nombre_razon_social", "email"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        df = df.fillna("")

        # Skip template description/example rows: any row where dni_nif starts with "DNI"
        # (comes from the template's description row "DNI / NIF / NIE / CIF [OBLIGATORIO]")
        if "dni_nif" in df.columns:
            df = df[~df["dni_nif"].str.upper().str.startswith("DNI")]
        # Also skip fully blank rows
        df = df[df.apply(lambda r: any(str(v).strip() for v in r), axis=1)]
        df = df.reset_index(drop=True)

        created_count = 0
        updated_count = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                dni = str(row.get("dni_nif", "")).strip()
                nombre = str(row.get("nombre_razon_social", "")).strip() or "Sin nombre"
                email = str(row.get("email", "")).strip().lower()

                import secrets as _secrets
                numero_socio_raw = str(row.get("numero_socio", "")).strip()

                # Upsert User — solo si hay email
                first_name = str(row.get("first_name", "")).strip()
                last_name = str(row.get("last_name", "")).strip()
                user = None
                if email:
                    user, u_created = User.objects.get_or_create(
                        email=email,
                        defaults={
                            "tenant": tenant,
                            "first_name": first_name,
                            "last_name": last_name,
                        },
                    )
                    if u_created:
                        user.set_password(_secrets.token_urlsafe(16))
                        user.save()
                    elif first_name or last_name:
                        if first_name:
                            user.first_name = first_name
                        if last_name:
                            user.last_name = last_name
                        user.save(update_fields=[f for f in ["first_name", "last_name"] if locals().get(f)])

                # ── Campos opcionales con parsing ────────────────────────────
                fecha_alta = None
                fecha_alta_raw = str(row.get("fecha_alta", "")).strip()
                if fecha_alta_raw:
                    import datetime as _dt
                    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%Y %H:%M:%S"):
                        try:
                            fecha_alta = _dt.datetime.strptime(fecha_alta_raw, fmt).date()
                            break
                        except ValueError:
                            continue
                    if fecha_alta is None:
                        errors.append(f"Row {idx+2}: fecha_alta inválida ('{fecha_alta_raw}'), se ignora.")

                cuota_raw = str(row.get("cuota_anual_pagada", "")).strip()
                cuota_anual_pagada = None
                if cuota_raw:
                    try:
                        cuota_anual_pagada = int(float(cuota_raw))
                    except (ValueError, TypeError):
                        errors.append(f"Row {idx+2}: cuota_anual_pagada inválida ('{cuota_raw}'), se ignora.")

                estado_raw = str(row.get("estado", "")).strip().upper()
                estado = estado_raw if estado_raw in ("ALTA", "BAJA") else "ALTA"

                razon_baja = str(row.get("razon_baja", "")).strip()

                fecha_baja = None
                fecha_baja_raw = str(row.get("fecha_baja", "")).strip()
                if fecha_baja_raw:
                    import datetime
                    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%Y %H:%M:%S"):
                        try:
                            fecha_baja = datetime.datetime.strptime(fecha_baja_raw, fmt).date()
                            break
                        except ValueError:
                            continue
                    if fecha_baja is None:
                        errors.append(f"Row {idx+2}: fecha_baja inválida ('{fecha_baja_raw}'), se ignora.")

                # Construir los campos del socio
                socio_fields = {
                    "nombre_razon_social": nombre,
                    "telefono": str(row.get("telefono", "")).strip(),
                    "domicilio": str(row.get("domicilio", "") or row.get("direccion", "")).strip(),
                    "municipio": str(row.get("municipio", "")).strip(),
                    "codigo_postal": str(row.get("codigo_postal", "")).strip(),
                    "provincia": str(row.get("provincia", "")).strip(),
                    "numero_cuenta": str(row.get("numero_cuenta", "")).strip(),
                    "numero_socio": numero_socio_raw,
                    "codigo_rega": str(row.get("codigo_rega", "")).strip(),
                    "fecha_alta": fecha_alta,
                    "cuota_anual_pagada": cuota_anual_pagada,
                    "estado": estado,
                    "razon_baja": razon_baja,
                    "fecha_baja": fecha_baja,
                }

                # Clave de búsqueda: DNI > número de socio > usuario (en ese orden de preferencia)
                if dni:
                    socio, s_created = Socio.all_objects.get_or_create(
                        tenant=tenant, dni_nif=dni,
                        defaults={"user": user, **socio_fields},
                    )
                elif numero_socio_raw:
                    socio, s_created = Socio.all_objects.get_or_create(
                        tenant=tenant, numero_socio=numero_socio_raw,
                        defaults={"user": user, "dni_nif": "", **socio_fields},
                    )
                elif user is not None:
                    # Sin DNI ni número de socio: buscar por usuario (solo si hay user)
                    try:
                        socio = Socio.all_objects.get(tenant=tenant, user=user)
                        s_created = False
                    except Socio.DoesNotExist:
                        socio = Socio.all_objects.create(
                            tenant=tenant, user=user, dni_nif="", **socio_fields
                        )
                        s_created = True
                else:
                    # Sin DNI, número de socio ni email: crear siempre (no hay clave única)
                    socio = Socio.all_objects.create(
                        tenant=tenant, user=None, dni_nif="", **socio_fields
                    )
                    s_created = True
                if s_created:
                    created_count += 1
                else:
                    # Socio ya existe: actualizar solo los campos que vengan informados
                    update_fields = []
                    if nombre and nombre != "Sin nombre":
                        socio.nombre_razon_social = nombre; update_fields.append("nombre_razon_social")
                    for field, val in [
                        ("telefono",      str(row.get("telefono", "")).strip()),
                        ("domicilio",     str(row.get("domicilio", "") or row.get("direccion", "")).strip()),
                        ("municipio",     str(row.get("municipio", "")).strip()),
                        ("codigo_postal", str(row.get("codigo_postal", "")).strip()),
                        ("provincia",     str(row.get("provincia", "")).strip()),
                        ("numero_cuenta", str(row.get("numero_cuenta", "")).strip()),
                        ("numero_socio",  str(row.get("numero_socio", "")).strip()),
                        ("codigo_rega",   str(row.get("codigo_rega", "")).strip()),
                        ("razon_baja",    razon_baja),
                    ]:
                        if val:
                            setattr(socio, field, val); update_fields.append(field)
                    for field, val in [
                        ("fecha_alta",         fecha_alta),
                        ("cuota_anual_pagada",  cuota_anual_pagada),
                        ("fecha_baja",          fecha_baja),
                    ]:
                        if val is not None:
                            setattr(socio, field, val); update_fields.append(field)
                    if estado_raw in ("ALTA", "BAJA"):
                        socio.estado = estado; update_fields.append("estado")
                    if update_fields:
                        socio.save(update_fields=update_fields)
                    updated_count += 1

            except Exception as e:
                errors.append(f"Row {idx+2}: {str(e)}")

        job.result_summary = {
            "total_rows": len(df),
            "created": created_count,
            "updated": updated_count,
            "errors": errors,
        }
        job.status = ImportJob.Status.DONE

    except Exception as e:
        job.status = ImportJob.Status.FAILED
        job.error_log = traceback.format_exc()
        logger.error(f"ImportJob {job_id} failed: {e}")

    finally:
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "result_summary", "error_log", "finished_at"])
