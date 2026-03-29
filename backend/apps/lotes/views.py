from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSocioOwner, get_effective_is_gestion
from .models import Lote
from .serializers import LoteSerializer


def _check_lote_access(lote, request):
    """Returns True if the requester may access this lote."""
    if get_effective_is_gestion(request):
        return True
    try:
        return lote.socio == request.user.socio
    except Exception:
        return False


class LoteListCreateView(generics.ListCreateAPIView):
    serializer_class = LoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Lote.objects.select_related("socio", "macho")
        # Use JWT claim, not DB field, to respect the dual-login checkbox
        if not get_effective_is_gestion(self.request):
            try:
                qs = qs.filter(socio=self.request.user.socio)
            except Exception:
                return Lote.objects.none()
        return qs

    def perform_create(self, serializer):
        tenant = self.request.tenant
        if get_effective_is_gestion(self.request):
            serializer.save(tenant=tenant)
        else:
            serializer.save(tenant=tenant, socio=self.request.user.socio)


class LoteDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = LoteSerializer
    permission_classes = [IsAuthenticated, IsSocioOwner]

    def get_queryset(self):
        return Lote.objects.select_related("socio", "macho").prefetch_related("hembras")

    def delete(self, request, *args, **kwargs):
        lote = self.get_object()
        if lote.crias.exists():
            return Response(
                {"detail": "No se puede eliminar un lote que tiene crías registradas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        lote.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoteCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            lote = Lote.objects.get(pk=pk)
        except Lote.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not get_effective_is_gestion(request):
            try:
                if lote.socio != request.user.socio:
                    return Response({"detail": "Permission denied."}, status=403)
            except Exception:
                return Response({"detail": "Permission denied."}, status=403)

        from django.utils import timezone
        lote.is_closed = True
        if not lote.fecha_fin:
            lote.fecha_fin = timezone.now().date()
        lote.save(update_fields=["is_closed", "fecha_fin"])
        return Response(LoteSerializer(lote).data)


class LoteHembrasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            lote = Lote.objects.prefetch_related("hembras__socio").get(pk=pk)
        except Lote.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not _check_lote_access(lote, request):
            return Response({"detail": "Not found."}, status=404)

        data = [
            {
                "id": str(h.id),
                "numero_anilla": h.numero_anilla,
                "anio_nacimiento": h.anio_nacimiento,
                "variedad": h.variedad,
                "socio_nombre": h.socio.nombre_razon_social,
            }
            for h in lote.hembras.all()
        ]
        return Response(data)


class LoteCriasView(APIView):
    """GET /api/v1/lotes/<pk>/crias/ — all offspring registered for this lote."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            lote = Lote.objects.get(pk=pk)
        except Lote.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not _check_lote_access(lote, request):
            return Response({"detail": "Not found."}, status=404)

        crias = lote.crias.select_related("socio").order_by("fecha_nacimiento", "numero_anilla")
        data = [
            {
                "id": str(c.id),
                "numero_anilla": c.numero_anilla,
                "fecha_nacimiento": str(c.fecha_nacimiento) if c.fecha_nacimiento else None,
                "sexo": c.sexo,
                "variedad": c.variedad,
                "estado": c.estado,
            }
            for c in crias
        ]
        return Response(data)
