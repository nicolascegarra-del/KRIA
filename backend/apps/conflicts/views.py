from django.utils import timezone
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion
from .models import Conflicto, SolicitudRealta
from .serializers import ConflictoSerializer, SolicitudRealtaSerializer


def _notificar_realta(tenant, socio, tipo, animal):
    """Crea notificación al socio sobre resolución de re-alta. Never raises."""
    try:
        if not socio or not getattr(socio, "user_id", None):
            return
        from apps.accounts.models import Notificacion
        anilla = animal.numero_anilla if animal else ""
        if tipo == "REALTA_APROBADA":
            mensaje = f"La solicitud de re-alta de tu animal {anilla} ha sido aprobada."
        else:
            mensaje = f"La solicitud de re-alta de tu animal {anilla} ha sido denegada."
        Notificacion.objects.create(
            tenant=tenant,
            usuario_id=socio.user_id,
            tipo=tipo,
            animal_id_str=str(animal.id) if animal else "",
            animal_anilla=anilla,
            mensaje=mensaje,
        )
    except Exception:
        pass


class ConflictoListView(generics.ListAPIView):
    serializer_class = ConflictoSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Conflicto.objects.filter(
            tenant=self.request.tenant,
            estado=Conflicto.Estado.PENDIENTE,
        ).select_related("socio_reclamante", "socio_actual")


class ConflictoResolveView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            conflicto = Conflicto.objects.get(pk=pk, tenant=request.tenant)
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


class SolicitudRealtaListView(generics.ListAPIView):
    """GET /api/v1/dashboard/solicitudes-realta/ — lista solicitudes pendientes (solo Gestión)."""
    serializer_class = SolicitudRealtaSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return SolicitudRealta.all_objects.filter(
            tenant=self.request.tenant,
            estado=SolicitudRealta.Estado.PENDIENTE,
        ).select_related("animal", "solicitante")


class SolicitudRealtaResolveView(APIView):
    """POST /api/v1/dashboard/solicitudes-realta/:id/resolver/ — gestión aprueba o deniega."""
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            solicitud = SolicitudRealta.all_objects.select_related("animal", "solicitante").get(pk=pk, tenant=request.tenant)
        except SolicitudRealta.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if solicitud.estado != SolicitudRealta.Estado.PENDIENTE:
            return Response({"detail": "Esta solicitud ya fue resuelta."}, status=400)

        accion = request.data.get("accion")  # "aprobar" o "denegar"
        if accion not in ("aprobar", "denegar"):
            return Response({"detail": "accion debe ser 'aprobar' o 'denegar'."}, status=400)

        solicitud.notas = request.data.get("notas", solicitud.notas)
        solicitud.resolved_at = timezone.now()

        if accion == "aprobar":
            solicitud.estado = SolicitudRealta.Estado.APROBADO
            solicitud.save()
            # Reactivar animal: vuelve a AÑADIDO, se limpian baja y razon_rechazo
            animal = solicitud.animal
            animal.estado = "AÑADIDO"
            animal.fecha_baja = None
            animal.motivo_baja = None
            animal.razon_rechazo = ""
            animal.save(update_fields=["estado", "fecha_baja", "motivo_baja", "razon_rechazo"])
            _notificar_realta(request.tenant, solicitud.solicitante, "REALTA_APROBADA", animal)
        else:
            solicitud.estado = SolicitudRealta.Estado.DENEGADO
            solicitud.save()
            _notificar_realta(request.tenant, solicitud.solicitante, "REALTA_DENEGADA", solicitud.animal)

        return Response(SolicitudRealtaSerializer(solicitud).data)


class DashboardTareasPendientesView(APIView):
    permission_classes = [IsGestion]

    def get(self, request):
        from apps.animals.models import Animal
        from apps.imports.models import ImportJob

        tenant = request.tenant

        pendientes_aprobacion = Animal.all_objects.filter(
            tenant=tenant,
            estado=Animal.Estado.AÑADIDO,
        ).count()

        conflictos_pendientes = Conflicto.all_objects.filter(
            tenant=tenant,
            estado=Conflicto.Estado.PENDIENTE,
        ).count()

        imports_pendientes = ImportJob.all_objects.filter(
            tenant=tenant,
            status__in=[ImportJob.Status.PENDING, ImportJob.Status.PROCESSING],
        ).count()

        candidatos_reproductor = Animal.all_objects.filter(
            tenant=tenant,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        ).count()

        alertas_anilla = Animal.all_objects.filter(
            tenant=tenant,
            alerta_anilla__in=["FUERA_RANGO", "DIAMETRO"],
        ).count()

        solicitudes_realta = SolicitudRealta.all_objects.filter(
            tenant=tenant,
            estado=SolicitudRealta.Estado.PENDIENTE,
        ).count()

        return Response({
            "pendientes_aprobacion": pendientes_aprobacion,
            "conflictos_pendientes": conflictos_pendientes,
            "imports_pendientes": imports_pendientes,
            "candidatos_reproductor": candidatos_reproductor,
            "alertas_anilla": alertas_anilla,
            "solicitudes_realta": solicitudes_realta,
        })
