import uuid

from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion
from core.throttles import UploadRateThrottle
from .models import ImportJob
from .tasks import process_import_job


class SocioImportView(APIView):
    permission_classes = [IsGestion]
    throttle_classes = [UploadRateThrottle]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided."}, status=400)

        tenant = request.tenant
        file_key = f"imports/{tenant.slug}/{uuid.uuid4()}/{file.name}"

        # Upload to MinIO
        try:
            from apps.reports.storage import get_minio_client
            from django.conf import settings

            client = get_minio_client()
            client.put_object(
                settings.MINIO_BUCKET_NAME,
                file_key,
                file,
                length=file.size,
                content_type=file.content_type,
            )
        except Exception as e:
            return Response({"detail": f"Storage error: {str(e)}"}, status=500)

        job = ImportJob.objects.create(
            tenant=tenant,
            created_by=request.user,
            file_key=file_key,
        )

        process_import_job.delay(str(job.id))

        return Response({"job_id": str(job.id), "status": job.status}, status=202)


class ImportJobStatusView(APIView):
    permission_classes = [IsGestion]

    def get(self, request, job_id):
        try:
            job = ImportJob.objects.get(pk=job_id)
        except ImportJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        return Response({
            "id": str(job.id),
            "status": job.status,
            "result_summary": job.result_summary,
            "error_log": job.error_log,
            "created_at": job.created_at,
            "finished_at": job.finished_at,
        })
