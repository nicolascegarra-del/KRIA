"""
Serializers for accounts app: JWT customisation, User, Socio.
"""
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant
from .models import Socio, User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends JWT payload with:
      - tenant_id, tenant_slug
      - is_gestion flag
      - access_as_gestion (boolean from request body)
    """

    access_as_gestion = serializers.BooleanField(default=False, write_only=True)

    def validate(self, attrs):
        access_as_gestion = attrs.pop("access_as_gestion", False)
        data = super().validate(attrs)

        user = self.user
        # If user is not gestión but tries to access as gestión — reject
        if access_as_gestion and not (user.is_gestion or user.is_superadmin):
            raise serializers.ValidationError(
                {"access_as_gestion": "You do not have gestión access."}
            )

        # Embed custom claims in tokens
        refresh = self.get_token(user)
        refresh["tenant_id"] = str(user.tenant_id)
        refresh["tenant_slug"] = user.tenant.slug
        refresh["is_gestion"] = access_as_gestion and (user.is_gestion or user.is_superadmin)
        refresh["is_superadmin"] = user.is_superadmin
        refresh["full_name"] = user.full_name

        data["access"] = str(refresh.access_token)
        data["refresh"] = str(refresh)
        data["user"] = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_gestion": refresh["is_gestion"],
            "is_superadmin": user.is_superadmin,
            "tenant_id": str(user.tenant_id),
            "tenant_slug": user.tenant.slug,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "is_gestion", "is_superadmin", "is_active", "date_joined"]
        read_only_fields = ["id", "date_joined"]


class SocioSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    email = serializers.EmailField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False)
    last_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Socio
        fields = [
            "id", "nombre_razon_social", "dni_nif", "telefono", "direccion",
            "numero_socio", "codigo_rega", "estado", "razon_baja", "fecha_baja",
            "user", "email", "first_name", "last_name",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        tenant = self.context["request"].tenant
        email = validated_data.pop("email")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")

        user, created = User.objects.get_or_create(
            tenant=tenant,
            email=email,
            defaults={"first_name": first_name, "last_name": last_name},
        )
        if not created:
            user.first_name = first_name
            user.last_name = last_name
            user.save(update_fields=["first_name", "last_name"])
        else:
            password = secrets.token_urlsafe(12)
            user.set_password(password)
            user.save(update_fields=["password"])
            send_mail(
                subject="Bienvenido a AGAMUR — tus credenciales de acceso",
                message=(
                    f"Hola {first_name or email},\n\n"
                    f"Tu cuenta en AGAMUR ha sido creada.\n\n"
                    f"Email: {email}\n"
                    f"Contraseña: {password}\n\n"
                    f"Accede en: {settings.FRONTEND_URL}\n\n"
                    f"Te recomendamos cambiar la contraseña tras el primer acceso.\n\n"
                    f"Un saludo,\nEquipo AGAMUR"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )

        socio = Socio.objects.create(
            tenant=tenant, user=user, **validated_data
        )
        return socio


class SocioListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Socio
        fields = [
            "id", "nombre_razon_social", "dni_nif", "numero_socio",
            "codigo_rega", "estado", "email", "full_name",
        ]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    new_password = serializers.CharField(min_length=8)
