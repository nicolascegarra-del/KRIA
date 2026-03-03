from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSocioOwner, get_effective_is_gestion
from .models import Lote
from .serializers import LoteSerializer


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


class LoteCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            lote = Lote.objects.get(pk=pk)
        except Lote.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        from django.utils import timezone
        lote.is_closed = True
        if not lote.fecha_fin:
            lote.fecha_fin = timezone.now().date()
        lote.save(update_fields=["is_closed", "fecha_fin"])
        return Response(LoteSerializer(lote).data)
