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
            job = ReportJob.objects.get(pk=job_id)
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
        if not get_effective_is_gestion(request):
            # Socio can only request their own
            try:
                socio_id = str(request.user.socio.id)
            except Exception:
                return Response({"detail": "No socio profile."}, status=400)
        return _create_report_job(request, ReportJob.ReportType.INVENTORY, {"socio_id": socio_id})


class IndividualReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request, animal_id):
        return _create_report_job(request, ReportJob.ReportType.INDIVIDUAL, {"animal_id": str(animal_id)})


class GenealogyCertView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def post(self, request, animal_id):
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
        return _create_report_job(request, ReportJob.ReportType.CATALOGO_REPRODUCTORES, {})
