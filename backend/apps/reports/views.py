from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion, IsSocioOrGestion, get_effective_is_gestion
from core.throttles import UploadRateThrottle
from .models import ReportJob
from .tasks import generate_report


def _create_report_job(request, report_type: str, params: dict) -> Response:
    job = ReportJob.objects.create(
        tenant=request.tenant,
        created_by=request.user,
        report_type=report_type,
        params=params,
    )
    generate_report.delay(str(job.id))
    return Response({"job_id": str(job.id), "status": job.status}, status=202)


class ReportJobStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        try:
            job = ReportJob.objects.get(pk=job_id, tenant=request.tenant)
        except ReportJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        data = {
            "id": str(job.id),
            "report_type": job.report_type,
            "status": job.status,
            "created_at": job.created_at,
            "finished_at": job.finished_at,
            "error_log": job.error_log if job.status == ReportJob.Status.FAILED else None,
        }

        if job.status == ReportJob.Status.DONE and job.file_key:
            data["download_url"] = f"/api/v1/reports/job/{job_id}/download/"

        return Response(data)


class ReportJobDownloadView(APIView):
    """Streams the generated file directly from MinIO to the browser."""
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        try:
            job = ReportJob.objects.get(pk=job_id, tenant=request.tenant)
        except ReportJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if job.status != ReportJob.Status.DONE or not job.file_key:
            return Response({"detail": "Report not ready."}, status=404)

        from django.conf import settings
        from .storage import get_minio_client
        import os

        client = get_minio_client()
        bucket = settings.MINIO_BUCKET_NAME

        response_obj = client.get_object(bucket, job.file_key)

        # Determine content type and filename
        ext = os.path.splitext(job.file_key)[1].lower()
        content_types = {
            ".pdf": "application/pdf",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        content_type = content_types.get(ext, "application/octet-stream")
        filename = os.path.basename(job.file_key)

        streaming = StreamingHttpResponse(
            response_obj.stream(32 * 1024),
            content_type=content_type,
        )
        streaming["Content-Disposition"] = f'attachment; filename="{filename}"'
        return streaming


class InventoryReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request):
        socio_id = request.data.get("socio_id")
        formato = request.data.get("formato", "pdf")
        orden = request.data.get("orden", "variedad_anilla")
        if not get_effective_is_gestion(request):
            # Socio can only request their own
            try:
                socio_id = str(request.user.socio.id)
            except Exception:
                return Response({"detail": "No socio profile."}, status=400)
        return _create_report_job(request, ReportJob.ReportType.INVENTORY, {"socio_id": socio_id, "formato": formato, "orden": orden})


def _check_animal_ownership(request, animal_id):
    """Returns (animal, error_response). Socios can only request reports for their own animals."""
    from apps.animals.models import Animal
    try:
        animal = Animal.objects.get(pk=animal_id, tenant=request.tenant)
    except Animal.DoesNotExist:
        return None, Response({"detail": "Animal no encontrado."}, status=404)
    if not get_effective_is_gestion(request):
        try:
            if animal.socio != request.user.socio:
                return None, Response({"detail": "Animal no encontrado."}, status=404)
        except Exception:
            return None, Response({"detail": "Animal no encontrado."}, status=404)
    return animal, None


class IndividualReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request, animal_id):
        _, err = _check_animal_ownership(request, animal_id)
        if err:
            return err
        return _create_report_job(request, ReportJob.ReportType.INDIVIDUAL, {"animal_id": str(animal_id)})


class GenealogyCertView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request, animal_id):
        _, err = _check_animal_ownership(request, animal_id)
        if err:
            return err
        return _create_report_job(request, ReportJob.ReportType.GENEALOGY_CERT, {"animal_id": str(animal_id)})


class LibroGenealogicView(APIView):
    permission_classes = [IsGestion]
    throttle_classes = [UploadRateThrottle]

    def post(self, request):
        return _create_report_job(request, ReportJob.ReportType.LIBRO_GENEALOGICO, {})


class CatalogoReproductoresView(APIView):
    permission_classes = [IsGestion]
    throttle_classes = [UploadRateThrottle]

    def post(self, request):
        formato = request.data.get("formato", "pdf")
        orden = request.data.get("orden", "variedad_anilla")
        return _create_report_job(request, ReportJob.ReportType.CATALOGO_REPRODUCTORES, {"formato": formato, "orden": orden})


class AuditoriaReportView(APIView):
    """Genera el informe PDF de una auditoría. Accesible por gestión y por el socio propietario."""
    permission_classes = [IsSocioOrGestion]
    throttle_classes = [UploadRateThrottle]

    def post(self, request, auditoria_id):
        from apps.audits.models import AuditoriaSession
        try:
            auditoria = AuditoriaSession.objects.get(pk=auditoria_id, tenant=request.tenant)
        except AuditoriaSession.DoesNotExist:
            return Response({"detail": "Auditoría no encontrada."}, status=404)

        # Socios solo pueden generar el informe de sus propias auditorías
        if not get_effective_is_gestion(request):
            try:
                if auditoria.socio != request.user.socio:
                    return Response({"detail": "Auditoría no encontrada."}, status=404)
            except Exception:
                return Response({"detail": "Sin perfil de socio."}, status=400)

        return _create_report_job(request, ReportJob.ReportType.AUDITORIA, {"auditoria_id": str(auditoria_id)})
