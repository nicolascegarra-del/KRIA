"""
Serializers for accounts app: JWT customisation, User, Socio.
"""
import re
import secrets

from django.conf import settings
from core.mail import send_platform_mail
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant
from .models import Socio, User


# ── Spanish DNI / NIE / CIF validator (no external deps) ─────────────────────
_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"


def _validate_dni_nif(value: str) -> bool:
    """
    Validate Spanish DNI (8 digits + letter), NIE (X/Y/Z + 7 digits + letter)
    or CIF (company tax id, letter + 7 digits + control char).
    Returns True if the format and checksum are valid.
    """
    v = value.upper().strip()

    # DNI: 8 digits + letter
    m = re.match(r'^(\d{8})([A-Z])$', v)
    if m:
        return _DNI_LETTERS[int(m.group(1)) % 23] == m.group(2)

    # NIE: X/Y/Z + 7 digits + letter
    m = re.match(r'^([XYZ])(\d{7})([A-Z])$', v)
    if m:
        prefix_map = {'X': '0', 'Y': '1', 'Z': '2'}
        num = int(prefix_map[m.group(1)] + m.group(2))
        return _DNI_LETTERS[num % 23] == m.group(3)

    # CIF (empresas): letter + 7 digits + letter or digit (basic format check)
    if re.match(r'^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-Z0-9]$', v):
        return True

    return False


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends JWT payload with tenant_id, tenant_slug, is_gestion, is_superadmin.
    Email is globally unique — no tenant slug required at login for any user.
    """

    def validate(self, attrs):
        # Email is globally unique: use standard Django auth (works for all roles)
        data = super().validate(attrs)  # sets self.user, validates password

        user = self.user

        # Block login for users of suspended tenants (superadmins use the system
        # tenant which is always active, so they are never affected).
        if not user.is_superadmin and not user.tenant.is_active:
            raise serializers.ValidationError(
                "Esta asociación está suspendida. Contacte con el administrador de la plataforma."
            )

        effective_is_gestion = user.is_gestion or user.is_superadmin

        refresh = self.get_token(user)
        refresh["tenant_id"] = str(user.tenant_id)
        refresh["tenant_slug"] = user.tenant.slug
        refresh["is_gestion"] = effective_is_gestion
        refresh["is_superadmin"] = user.is_superadmin
        refresh["full_name"] = user.full_name

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_gestion": effective_is_gestion,
                "is_superadmin": user.is_superadmin,
                "tenant_id": str(user.tenant_id),
                "tenant_slug": user.tenant.slug,
            },
        }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_gestion", "is_superadmin", "is_active", "date_joined", "notif_nueva_asociacion", "notif_asociacion_suspendida", "notif_asociacion_activada", "notif_asociacion_eliminada", "notif_propuesta_mejora"]
        read_only_fields = ["id", "date_joined"]


class SocioSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    email = serializers.EmailField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)
    initial_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Socio
        fields = [
            "id", "nombre_razon_social", "dni_nif", "telefono",
            "domicilio", "municipio", "codigo_postal", "provincia", "numero_cuenta",
            "numero_socio", "codigo_rega", "fecha_alta", "cuota_anual_pagada",
            "estado", "razon_baja", "fecha_baja",
            "user", "email", "first_name", "last_name", "initial_password", "new_password",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "dni_nif": {"required": False, "allow_blank": True},
        }

    def validate_dni_nif(self, value):
        if value and not _validate_dni_nif(value):
            raise serializers.ValidationError(
                "DNI/NIF/NIE inválido. Introduce un documento de identidad español válido."
            )
        return value.upper().strip() if value else value

    def create(self, validated_data):
        tenant = self.context["request"].tenant
        email = validated_data.pop("email", None)
        initial_password = validated_data.pop("initial_password", None)
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")

        user = None
        if email:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"tenant": tenant, "first_name": first_name, "last_name": last_name},
            )
            if not created:
                user.first_name = first_name
                user.last_name = last_name
                user.save(update_fields=["first_name", "last_name"])
            else:
                password = initial_password if initial_password else secrets.token_urlsafe(12)
                user.set_password(password)
                user.save(update_fields=["password"])
                send_platform_mail(
                    subject="Bienvenido a KRIA — tus credenciales de acceso",
                    body=(
                        f"Hola {first_name or email},\n\n"
                        f"Tu cuenta en KRIA ha sido creada.\n\n"
                        f"Email: {email}\n"
                        f"Contraseña: {password}\n\n"
                        f"Accede en: {settings.FRONTEND_URL}\n\n"
                        f"Te recomendamos cambiar la contraseña tras el primer acceso.\n\n"
                        f"Un saludo,\nEquipo KRIA"
                    ),
                    recipient_list=[email],
                    tipo="ALTA_SOCIO",
                    fail_silently=True,
                )

        socio = Socio.objects.create(
            tenant=tenant, user=user, **validated_data
        )
        return socio

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["email"] = instance.user.email if instance.user_id else ""
        data["full_name"] = instance.user.full_name if instance.user_id else ""
        data["has_portal_access"] = bool(
            instance.user_id and instance.user.has_usable_password()
        )
        return data

    def update(self, instance, validated_data):
        email = validated_data.pop("email", None)
        validated_data.pop("first_name", None)
        validated_data.pop("last_name", None)
        validated_data.pop("initial_password", None)
        new_password = validated_data.pop("new_password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if instance.user_id:
            user_fields = []
            if email:
                instance.user.email = email
                user_fields.append("email")
            if new_password:
                instance.user.set_password(new_password)
                user_fields.append("password")
            if user_fields:
                instance.user.save(update_fields=user_fields)

        return instance


class SocioListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    email = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    has_portal_access = serializers.SerializerMethodField()

    def get_email(self, obj):
        return obj.user.email if obj.user_id else ""

    def get_full_name(self, obj):
        return obj.user.full_name if obj.user_id else ""

    def get_has_portal_access(self, obj):
        return bool(obj.user_id and obj.user.has_usable_password())

    class Meta:
        model = Socio
        fields = [
            "id", "nombre_razon_social", "dni_nif", "numero_socio",
            "codigo_rega", "telefono", "domicilio", "municipio", "codigo_postal",
            "provincia", "numero_cuenta", "fecha_alta",
            "cuota_anual_pagada", "estado", "razon_baja", "fecha_baja",
            "email", "full_name", "has_portal_access",
        ]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(min_length=8)
