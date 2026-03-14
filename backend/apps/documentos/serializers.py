from rest_framework import serializers
from .models import Documento


class DocumentoSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.CharField(source="subido_por.full_name", read_only=True, allow_null=True)
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True, allow_null=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            "id", "tipo", "socio", "socio_nombre",
            "nombre_archivo", "content_type", "tamanio_bytes",
            "version", "subido_por", "subido_por_nombre",
            "download_url", "created_at",
        ]
        read_only_fields = ["id", "version", "created_at"]

    def get_download_url(self, obj):
        try:
            from apps.reports.storage import get_presigned_download_url
            return get_presigned_download_url(obj.file_key, expiry_hours=1)
        except Exception:
            return None
