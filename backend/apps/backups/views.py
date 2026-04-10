"""
API views para exportar e importar backups de asociaciones.
Sólo accesible para superadmins.
"""
import io
import json
import uuid
import zipfile

from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSuperAdmin
from .models import BackupJob
from .serializers import BackupJobSerializer


class BackupExportView(APIView):
    """POST /api/v1/backups/export/  → lanza exportación async de una asociación."""
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from apps.tenants.models import Tenant

        tenant_id = request.data.get("tenant_id")
        if not tenant_id:
            return Response({"detail": "tenant_id requerido."}, status=400)

        try:
            tenant = Tenant.objects.get(pk=tenant_id)
        except (Tenant.DoesNotExist, Exception):
            return Response({"detail": "Asociación no encontrada."}, status=404)

        if tenant.slug == "system":
            return Response({"detail": "No se puede exportar el tenant del sistema."}, status=400)

        job = BackupJob.objects.create(
            tenant_id_snapshot=tenant.id,
            tenant_slug_snapshot=tenant.slug,
            tenant_name_snapshot=tenant.name,
            job_type=BackupJob.JobType.EXPORT,
            created_by=request.user,
        )

        from .tasks import export_backup
        export_backup.delay(str(job.id))

        return Response(BackupJobSerializer(job).data, status=202)


class BackupImportView(APIView):
    """POST /api/v1/backups/import/  → sube ZIP y lanza importación async."""
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from apps.tenants.models import Tenant
        from apps.reports.storage import upload_bytes

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "Se requiere un archivo ZIP."}, status=400)

        # Validación mínima del ZIP antes de encolar
        try:
            zip_bytes = file.read()
            with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
                if "manifest.json" not in zf.namelist():
                    return Response(
                        {"detail": "El archivo no es un backup válido (falta manifest.json)."},
                        status=400,
                    )
                manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
                tenant_info = manifest.get("tenant", {})
                tenant_id = tenant_info.get("id")
                tenant_slug = tenant_info.get("slug", "")
                tenant_name = tenant_info.get("name", "Desconocido")

                if not tenant_id or not tenant_slug:
                    return Response(
                        {"detail": "El manifest no contiene información válida del tenant."},
                        status=400,
                    )
        except zipfile.BadZipFile:
            return Response({"detail": "El archivo no es un ZIP válido."}, status=400)
        except Exception as exc:
            return Response({"detail": f"Error al leer el backup: {exc}"}, status=400)

        # Verificar que el tenant no existe
        if Tenant.objects.filter(pk=tenant_id).exists():
            return Response(
                {"detail": f"Ya existe una asociación con este identificador. No se puede importar."},
                status=400,
            )
        if Tenant.objects.filter(slug=tenant_slug).exists():
            return Response(
                {"detail": f"Ya existe una asociación con el slug '{tenant_slug}'. Cambia el slug antes de importar."},
                status=400,
            )

        # Guardar ZIP en MinIO temporalmente
        file_key = f"backups/imports/{uuid.uuid4()}.zip"
        upload_bytes(file_key, zip_bytes, "application/zip")

        job = BackupJob.objects.create(
            tenant_id_snapshot=tenant_id,
            tenant_slug_snapshot=tenant_slug,
            tenant_name_snapshot=tenant_name,
            job_type=BackupJob.JobType.IMPORT,
            created_by=request.user,
            file_key=file_key,
            file_size_bytes=len(zip_bytes),
        )

        from .tasks import import_backup
        import_backup.delay(str(job.id))

        return Response(BackupJobSerializer(job).data, status=202)


class BackupJobListView(APIView):
    """GET /api/v1/backups/jobs/  → lista los últimos 100 jobs."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        jobs = BackupJob.objects.select_related("created_by").order_by("-created_at")[:100]
        return Response(BackupJobSerializer(jobs, many=True).data)


class BackupJobDetailView(APIView):
    """GET /api/v1/backups/jobs/{id}/  → estado actual de un job."""
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        try:
            job = BackupJob.objects.select_related("created_by").get(pk=pk)
        except BackupJob.DoesNotExist:
            return Response({"detail": "No encontrado."}, status=404)
        return Response(BackupJobSerializer(job).data)


class BackupJobDownloadView(APIView):
    """GET /api/v1/backups/jobs/{id}/download/  → URL de descarga del ZIP exportado."""
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        try:
            job = BackupJob.objects.get(
                pk=pk,
                job_type=BackupJob.JobType.EXPORT,
                status=BackupJob.Status.COMPLETED,
            )
        except BackupJob.DoesNotExist:
            return Response({"detail": "Backup no disponible para descarga."}, status=404)

        if not job.file_key:
            return Response({"detail": "Archivo no disponible."}, status=404)

        from apps.reports.storage import get_presigned_download_url
        url = get_presigned_download_url(job.file_key)
        filename = f"backup_{job.tenant_slug_snapshot}_{job.created_at.strftime('%Y%m%d_%H%M%S')}.zip"
        return Response({"url": url, "filename": filename})
