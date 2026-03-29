"""
Gestor documental: repositorio general (Junta) y buzón particular (Socio).
"""
import uuid

from rest_framework import generics
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.storage import get_minio_client, upload_bytes
from core.permissions import IsGestion, get_effective_is_gestion
from .models import Documento
from .serializers import DocumentoSerializer

MAX_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def _check_mime(data: bytes) -> str | None:
    """
    Returns detected content-type for allowed types, None otherwise.
    """
    if data[:4] == b'%PDF':
        return "application/pdf"
    if data[:3] == b'\xff\xd8\xff':
        return "image/jpeg"
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    return None


def _next_version(tenant, tipo, socio, nombre_archivo) -> int:
    """Calculate the next version for a document with the same name."""
    last = Documento.all_objects.filter(
        tenant=tenant, tipo=tipo, socio=socio, nombre_archivo=nombre_archivo
    ).order_by("-version").first()
    return (last.version + 1) if last else 1


def _upload_documento(request, tipo, socio=None) -> Response:
    """Shared upload logic for GENERAL and PARTICULAR documents."""
    file = request.FILES.get("file")
    if not file:
        return Response({"detail": "No file provided."}, status=400)

    if file.size > MAX_SIZE_BYTES:
        return Response({"detail": "El archivo supera el límite de 20 MB."}, status=400)

    file_bytes = file.read()
    detected_ct = _check_mime(file_bytes)
    if detected_ct is None:
        return Response(
            {"detail": "Tipo de archivo no permitido. Solo se aceptan PDF, JPEG o PNG."},
            status=400,
        )

    tenant = request.tenant
    nombre = file.name
    version = _next_version(tenant, tipo, socio, nombre)

    scope = f"socios/{socio.id}" if socio else "general"
    file_key = f"documentos/{tenant.slug}/{scope}/{uuid.uuid4()}_{nombre}"

    try:
        upload_bytes(file_key, file_bytes, detected_ct)
    except Exception as e:
        return Response({"detail": f"Error de almacenamiento: {str(e)}"}, status=500)

    doc = Documento.all_objects.create(
        tenant=tenant,
        tipo=tipo,
        socio=socio,
        nombre_archivo=nombre,
        file_key=file_key,
        content_type=detected_ct,
        tamanio_bytes=file.size,
        subido_por=request.user,
        version=version,
    )
    return Response(DocumentoSerializer(doc).data, status=201)


class DocumentoGeneralListView(generics.ListAPIView):
    """GET /api/v1/documentos/general/ — lista docs generales (solo Gestión)."""
    serializer_class = DocumentoSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Documento.all_objects.filter(
            tenant=self.request.tenant, tipo=Documento.Tipo.GENERAL
        ).select_related("subido_por")


class DocumentoGeneralUploadView(APIView):
    """POST /api/v1/documentos/general/ — sube un documento general (solo Gestión)."""
    permission_classes = [IsGestion]
    parser_classes = [MultiPartParser]

    def post(self, request):
        return _upload_documento(request, Documento.Tipo.GENERAL, socio=None)


class DocumentoSocioListView(APIView):
    """GET /api/v1/documentos/socios/<socio_id>/ — lista buzón del socio."""

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request, socio_id):
        # Gestión ve cualquier socio; socio solo ve el suyo
        if not get_effective_is_gestion(request):
            try:
                if str(request.user.socio.id) != str(socio_id):
                    return Response({"detail": "Permission denied."}, status=403)
            except Exception:
                return Response({"detail": "Permission denied."}, status=403)

        docs = Documento.all_objects.filter(
            tenant=request.tenant, tipo=Documento.Tipo.PARTICULAR, socio_id=socio_id
        ).select_related("subido_por", "socio")
        return Response(DocumentoSerializer(docs, many=True).data)


class DocumentoSocioUploadView(APIView):
    """POST /api/v1/documentos/socios/<socio_id>/ — sube doc al buzón del socio (solo Gestión)."""
    permission_classes = [IsGestion]
    parser_classes = [MultiPartParser]

    def post(self, request, socio_id):
        from apps.accounts.models import Socio
        try:
            socio = Socio.all_objects.get(pk=socio_id, tenant=request.tenant)
        except Socio.DoesNotExist:
            return Response({"detail": "Socio no encontrado."}, status=404)
        return _upload_documento(request, Documento.Tipo.PARTICULAR, socio=socio)


class DocumentoDetailView(APIView):
    """DELETE /api/v1/documentos/<id>/ — elimina un documento (solo Gestión)."""
    permission_classes = [IsGestion]

    def delete(self, request, pk):
        try:
            doc = Documento.all_objects.get(pk=pk, tenant=request.tenant)
        except Documento.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Remove from MinIO (best-effort)
        try:
            from django.conf import settings
            client = get_minio_client()
            client.remove_object(settings.MINIO_BUCKET_NAME, doc.file_key)
        except Exception:
            pass

        doc.delete()
        return Response(status=204)


class DocumentoDownloadView(APIView):
    """GET /api/v1/documentos/<id>/download/ — URL de descarga con expiración."""

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request, pk):
        try:
            doc = Documento.all_objects.get(pk=pk, tenant=request.tenant)
        except Documento.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Socio solo puede descargar sus propios documentos
        if not get_effective_is_gestion(request):
            if doc.tipo == Documento.Tipo.GENERAL:
                return Response({"detail": "Permission denied."}, status=403)
            try:
                if doc.socio_id != request.user.socio.id:
                    return Response({"detail": "Permission denied."}, status=403)
            except Exception:
                return Response({"detail": "Permission denied."}, status=403)

        try:
            from apps.reports.storage import get_presigned_download_url
            url = get_presigned_download_url(doc.file_key, expiry_hours=1)
        except Exception as e:
            return Response({"detail": f"Error generando URL: {str(e)}"}, status=500)

        return Response({"download_url": url, "nombre_archivo": doc.nombre_archivo})
