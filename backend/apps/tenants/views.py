from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Tenant
from .serializers import TenantBrandingSerializer


class TenantBrandingView(APIView):
    """Public endpoint — returns branding for the current tenant."""
    permission_classes = [AllowAny]

    def get(self, request):
        tenant = getattr(request, "tenant", None)

        if tenant is None:
            # Try header resolution (PWA boot before auth)
            slug = request.headers.get("X-Tenant-Slug", "").strip().lower()
            if slug:
                try:
                    tenant = Tenant.objects.get(slug=slug, is_active=True)
                except Tenant.DoesNotExist:
                    pass

        if tenant is None:
            return Response({"detail": "Tenant not found."}, status=404)

        return Response(TenantBrandingSerializer(tenant).data)
