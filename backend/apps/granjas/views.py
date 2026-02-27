"""
Granja API views.
Socios manage their own granjas; gestión can see and create for any socio.
"""
from rest_framework import generics, filters
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from core.permissions import IsSocioOwner, get_effective_is_gestion
from .models import Granja
from .serializers import GranjaSerializer, GranjaReadSerializer


class GranjaListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "codigo_rega", "socio__nombre_razon_social"]
    ordering_fields = ["nombre", "created_at"]
    ordering = ["nombre"]

    def get_serializer_class(self):
        if self.request.method == "GET" and get_effective_is_gestion(self.request):
            return GranjaReadSerializer
        return GranjaSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Granja.objects.select_related("socio")
        if not get_effective_is_gestion(self.request):
            try:
                qs = qs.filter(socio=user.socio)
            except Exception:
                return Granja.objects.none()
        return qs

    def perform_create(self, serializer):
        tenant = self.request.tenant
        user = self.request.user

        if get_effective_is_gestion(self.request):
            socio_id = self.request.data.get("socio")
            if not socio_id:
                raise ValidationError({"socio": ["Este campo es obligatorio para el equipo de gestión."]})
            from apps.accounts.models import Socio
            try:
                socio = Socio.objects.get(pk=socio_id, tenant=tenant)
            except Socio.DoesNotExist:
                raise ValidationError({"socio": ["Socio no encontrado."]})
            serializer.save(tenant=tenant, socio=socio)
        else:
            try:
                socio = user.socio
            except Exception:
                raise PermissionDenied("El usuario no tiene un perfil de socio.")
            serializer.save(tenant=tenant, socio=socio)


class GranjaDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsSocioOwner]
    queryset = Granja.objects.select_related("socio")

    def get_serializer_class(self):
        if self.request.method == "GET" and get_effective_is_gestion(self.request):
            return GranjaReadSerializer
        return GranjaSerializer
