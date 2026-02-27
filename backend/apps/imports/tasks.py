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

        created_count = 0
        updated_count = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                dni = str(row.get("dni_nif", "")).strip()
                nombre = str(row.get("nombre_razon_social", "")).strip()
                email = str(row.get("email", "")).strip().lower()

                if not dni or not email:
                    errors.append(f"Row {idx+2}: dni_nif and email are required.")
                    continue

                # Upsert User
                user, u_created = User.objects.update_or_create(
                    tenant=tenant,
                    email=email,
                    defaults={
                        "first_name": str(row.get("first_name", "")).strip(),
                        "last_name": str(row.get("last_name", "")).strip(),
                    },
                )
                if u_created:
                    # Set a random password — user must reset
                    import secrets
                    user.set_password(secrets.token_urlsafe(16))
                    user.save()

                # Upsert Socio
                socio, s_created = Socio.objects.update_or_create(
                    tenant=tenant,
                    dni_nif=dni,
                    defaults={
                        "user": user,
                        "nombre_razon_social": nombre,
                        "telefono": str(row.get("telefono", "")).strip(),
                        "direccion": str(row.get("direccion", "")).strip(),
                        "numero_socio": str(row.get("numero_socio", "")).strip(),
                        "codigo_rega": str(row.get("codigo_rega", "")).strip(),
                    },
                )
                if s_created:
                    created_count += 1
                else:
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
