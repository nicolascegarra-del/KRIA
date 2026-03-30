from rest_framework import serializers
from .models import Tenant, PlatformSettings


class TenantBrandingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ["id", "name", "slug", "logo_url", "primary_color", "secondary_color",
                  "granjas_enabled", "anilla_sizes"]


class TenantSerializer(serializers.ModelSerializer):
    socios_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Tenant
        fields = [
            "id", "name", "slug", "logo_url", "primary_color", "secondary_color",
            "custom_domain", "is_active", "max_socios", "socios_count", "created_at",
            "nombre_completo", "cif", "domicilio", "cod_postal", "municipio", "provincia",
            "email_asociacion",
            "telefono1", "telefono1_nombre", "telefono1_cargo", "telefono1_email",
            "telefono2", "telefono2_nombre", "telefono2_cargo", "telefono2_email",
            "granjas_enabled", "anilla_sizes", "email_notificaciones",
            "smtp_host", "smtp_port", "smtp_user", "smtp_password",
            "smtp_from_email", "smtp_from_name", "smtp_use_tls", "smtp_use_ssl",
        ]


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = [
            "smtp_host", "smtp_port", "smtp_user", "smtp_password",
            "smtp_from_email", "smtp_from_name", "smtp_use_tls", "smtp_use_ssl",
            "inactivity_timeout_minutes",
        ]


class GestionUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, default="")
    last_name = serializers.CharField(max_length=150, default="")
    password = serializers.CharField(min_length=8, write_only=True)
