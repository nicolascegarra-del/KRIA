from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion
from .models import Conflicto
from .serializers import ConflictoSerializer


class ConflictoListView(generics.ListAPIView):
    serializer_class = ConflictoSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Conflicto.objects.filter(estado=Conflicto.Estado.PENDIENTE).select_related(
            "socio_reclamante", "socio_actual"
        )


class ConflictoResolveView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            conflicto = Conflicto.objects.get(pk=pk)
        except Conflicto.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        action = request.data.get("action")  # "resolve" or "discard"
        if action == "resolve":
            conflicto.estado = Conflicto.Estado.RESUELTO
        elif action == "discard":
            conflicto.estado = Conflicto.Estado.DESCARTADO
        else:
            return Response({"detail": "action must be 'resolve' or 'discard'."}, status=400)

        conflicto.notas = request.data.get("notas", conflicto.notas)
        conflicto.resolved_at = timezone.now()
        conflicto.save()
        return Response(ConflictoSerializer(conflicto).data)


class DashboardTareasPendientesView(APIView):
    permission_classes = [IsGestion]

    def get(self, request):
        from apps.animals.models import Animal
        from apps.imports.models import ImportJob

        pendientes_aprobacion = Animal.objects.filter(estado=Animal.Estado.AÑADIDO).count()
        conflictos_pendientes = Conflicto.objects.filter(estado=Conflicto.Estado.PENDIENTE).count()
        imports_pendientes = ImportJob.objects.filter(
            status__in=["PENDING", "PROCESSING"]
        ).count()

        return Response({
            "pendientes_aprobacion": pendientes_aprobacion,
            "conflictos_pendientes": conflictos_pendientes,
            "imports_pendientes": imports_pendientes,
        })
