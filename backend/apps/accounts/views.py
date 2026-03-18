"""
Account views: JWT login, password reset, Socio CRUD.
"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsGestion, IsSocioOrGestion
from .models import Socio, User
from .serializers import (
    CustomTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SocioListSerializer,
    SocioSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        tenant = getattr(request, "tenant", None)

        try:
            user = User.objects.get(email=email, tenant=tenant)
        except User.DoesNotExist:
            # Don't leak user existence
            return Response({"detail": "If that email exists, a reset link was sent."})

        token = uuid.uuid4()
        user.reset_token = token
        user.reset_token_created = timezone.now()
        user.save(update_fields=["reset_token", "reset_token_created"])

        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
        send_mail(
            subject="Restablecimiento de contraseña — KRIA",
            message=f"Haz clic en el enlace para restablecer tu contraseña:\n{reset_url}\n\nEste enlace expira en 24 horas.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )
        return Response({"detail": "If that email exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user = User.objects.get(reset_token=token)
        except User.DoesNotExist:
            return Response({"detail": "Invalid or expired token."}, status=400)

        timeout = timedelta(seconds=settings.PASSWORD_RESET_TIMEOUT)
        if user.reset_token_created and timezone.now() - user.reset_token_created > timeout:
            return Response({"detail": "Token expired."}, status=400)

        user.set_password(new_password)
        user.reset_token = None
        user.reset_token_created = None
        user.save(update_fields=["password", "reset_token", "reset_token_created"])

        return Response({"detail": "Password updated successfully."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_gestion": user.is_gestion,
            "is_superadmin": user.is_superadmin,
            "tenant_id": str(user.tenant_id),
            "tenant_slug": user.tenant.slug,
        }
        return Response(data)


# ── Socio Views ───────────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"detail": "current_password y new_password son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"detail": "La contraseña actual es incorrecta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "La nueva contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada correctamente."})


class SocioListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsGestion]
    ordering = ["nombre_razon_social"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return SocioListSerializer
        return SocioSerializer

    def get_queryset(self):
        return Socio.objects.select_related("user").order_by("nombre_razon_social")


class SocioDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsGestion]
    serializer_class = SocioSerializer

    def get_queryset(self):
        return Socio.objects.select_related("user").all()


class SocioMeView(APIView):
    """Returns the Socio record linked to the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            socio = Socio.objects.select_related("user").get(user=request.user)
        except Socio.DoesNotExist:
            return Response({"detail": "No tienes un perfil de socio."}, status=404)
        return Response(SocioListSerializer(socio).data)


class SocioDarBajaView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            socio = Socio.objects.get(pk=pk)
        except Socio.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if socio.estado == Socio.Estado.BAJA:
            return Response({"detail": "Socio ya está en BAJA."}, status=400)

        razon = request.data.get("razon_baja", "")
        from django.utils import timezone as tz
        socio.estado = Socio.Estado.BAJA
        socio.razon_baja = razon
        socio.fecha_baja = tz.now().date()
        socio.save()

        return Response({"detail": "Socio dado de baja correctamente."})
