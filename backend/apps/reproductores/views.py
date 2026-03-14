"""
Public catalog of approved reproductores + gestión endpoint for candidates.
"""
from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.animals.models import Animal
from apps.animals.serializers import AnimalDetailSerializer
from core.permissions import IsGestion


class ReproductorListView(generics.ListAPIView):
    """
    Public endpoint listing all animals marked as reproductor_aprobado.
    Requires X-Tenant-Slug header (resolved by TenantMiddleware) to scope
    catalog per association.
    """
    serializer_class = AnimalDetailSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Always filter explicitly by request.tenant to avoid cross-tenant leakage
        # if the thread-local is not set (e.g. async contexts or test bypasses).
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            return Animal.objects.none()

        return Animal.all_objects.filter(
            tenant=tenant,
            reproductor_aprobado=True,
        ).select_related("socio", "padre", "madre_animal").order_by("variedad", "numero_anilla")


class CandidatosReproductorView(generics.ListAPIView):
    """
    GET /api/v1/reproductores/candidatos/ — animales propuestos por socios
    pendientes de revisión por gestión (candidato=True, aprobado=False).
    """
    serializer_class = AnimalDetailSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Animal.all_objects.filter(
            tenant=self.request.tenant,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        ).select_related("socio", "padre", "madre_animal").order_by("variedad", "numero_anilla")
