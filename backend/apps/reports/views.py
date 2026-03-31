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
            from .storage import get_presigned_download_url
            data["download_url"] = get_presigned_download_url(job.file_key, expiry_hours=24)

        return Response(data)


class InventoryReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request):
        socio_id = request.data.get("socio_id")
        formato = request.data.get("formato", "pdf")
        if not get_effective_is_gestion(request):
            # Socio can only request their own
            try:
                socio_id = str(request.user.socio.id)
            except Exception:
                return Response({"detail": "No socio profile."}, status=400)
        return _create_report_job(request, ReportJob.ReportType.INVENTORY, {"socio_id": socio_id, "formato": formato})


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
        return _create_report_job(request, ReportJob.ReportType.CATALOGO_REPRODUCTORES, {"formato": formato})


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
