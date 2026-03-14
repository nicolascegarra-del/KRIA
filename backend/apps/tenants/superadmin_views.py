"""
SuperAdmin API — gestión de tenants y usuarios a nivel de plataforma.
Requiere is_superadmin=True en el User.
"""
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSuperAdmin
from .models import Tenant
from .serializers import TenantSerializer


class SuperAdminTenantListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/superadmin/tenants/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return Tenant.objects.all().order_by("name")


class SuperAdminTenantDetailView(generics.RetrieveUpdateAPIView):
    """GET/PUT /api/v1/superadmin/tenants/:id/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Tenant.objects.all()


class SuperAdminTenantLogoView(APIView):
    """POST /api/v1/superadmin/tenants/:id/logo/ — sube logo a MinIO y guarda URL."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        file = request.FILES.get("logo")
        if not file:
            return Response({"detail": "No file provided."}, status=400)

        try:
            from apps.reports.storage import upload_bytes, get_presigned_download_url
            key = f"tenants/{tenant.slug}/logo/{file.name}"
            upload_bytes(key, file.read(), file.content_type or "image/png")
            url = get_presigned_download_url(key, expiry_hours=24 * 365)
            tenant.logo_url = url
            tenant.save(update_fields=["logo_url"])
        except Exception as e:
            return Response({"detail": f"Error uploading logo: {str(e)}"}, status=500)

        return Response(TenantSerializer(tenant).data)


class SuperAdminUserResetPasswordView(APIView):
    """POST /api/v1/superadmin/users/:id/reset-password/ — genera token y lo devuelve."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from apps.accounts.models import User
        import uuid
        from django.utils import timezone

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        token = uuid.uuid4()
        user.reset_token = token
        user.reset_token_created = timezone.now()
        user.save(update_fields=["reset_token", "reset_token_created"])

        return Response({
            "user_id": str(user.id),
            "email": user.email,
            "reset_token": str(token),
        })


class SuperAdminStatsView(APIView):
    """GET /api/v1/superadmin/stats/ — estadísticas globales de la plataforma."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from apps.accounts.models import User, Socio
        from apps.animals.models import Animal

        return Response({
            "tenants": Tenant.objects.count(),
            "usuarios": User.objects.count(),
            "socios": Socio.all_objects.count(),
            "animales": Animal.all_objects.count(),
        })
