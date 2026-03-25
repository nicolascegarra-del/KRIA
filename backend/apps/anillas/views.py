"""
API views para gestión de rangos de anillas (solo Gestión).
"""
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion
from .models import EntregaAnillas
from .serializers import EntregaAnillasSerializer
from .utils import compute_alerta_anilla


class MisAnillasView(generics.ListAPIView):
    """GET /api/v1/anillas/mis-anillas/ — devuelve los rangos asignados al socio autenticado."""
    serializer_class = EntregaAnillasSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.accounts.models import Socio
        try:
            socio = Socio.objects.get(user=self.request.user, tenant=self.request.tenant)
        except Socio.DoesNotExist:
            return EntregaAnillas.objects.none()
        return EntregaAnillas.objects.filter(
            tenant=self.request.tenant,
            socio=socio,
        ).order_by("-anio_campana", "rango_inicio")


class EntregaAnillasListCreateView(generics.ListCreateAPIView):
    serializer_class = EntregaAnillasSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        qs = EntregaAnillas.objects.select_related("socio", "created_by").filter(
            tenant=self.request.tenant
        )
        anio = self.request.query_params.get("anio")
        socio_id = self.request.query_params.get("socio_id")
        if anio:
            qs = qs.filter(anio_campana=anio)
        if socio_id:
            qs = qs.filter(socio_id=socio_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user,
        )


class EntregaAnillasDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EntregaAnillasSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return EntregaAnillas.objects.filter(tenant=self.request.tenant)


class AnillaCheckView(APIView):
    """
    GET /api/v1/anillas/check/?anilla=X&anio=Y&socio_id=Z&sexo=M
    Verificación puntual: devuelve la alerta de anilla para un animal dado.
    """
    permission_classes = [IsGestion]

    def get(self, request):
        numero_anilla = request.query_params.get("anilla")
        anio = request.query_params.get("anio")
        socio_id = request.query_params.get("socio_id")
        sexo = request.query_params.get("sexo")

        if not all([numero_anilla, anio, socio_id, sexo]):
            return Response(
                {"detail": "Parámetros requeridos: anilla, anio, socio_id, sexo."},
                status=400,
            )

        try:
            anio_int = int(anio)
        except ValueError:
            return Response({"detail": "anio debe ser un número entero."}, status=400)

        alerta = compute_alerta_anilla(
            numero_anilla=numero_anilla,
            anio=anio_int,
            sexo=sexo.upper(),
            socio_id=socio_id,
            tenant_id=request.tenant.id,
        )

        return Response({
            "anilla": numero_anilla,
            "anio": anio_int,
            "socio_id": socio_id,
            "alerta": alerta,
        })
