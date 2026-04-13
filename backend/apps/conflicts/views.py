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
            # Reactivar animal: vuelve a REGISTRADO, se limpian baja y razon_rechazo
            animal = solicitud.animal
            animal.estado = "REGISTRADO"
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
        from django.db.models import Q
        from apps.animals.models import Animal
        from apps.accounts.models import Socio
        from apps.imports.models import ImportJob

        tenant = request.tenant
        year_now = timezone.now().year

        # ── Tareas pendientes ──────────────────────────────────────────────────
        pendientes_aprobacion = Animal.all_objects.filter(
            tenant=tenant,
            estado__in=[Animal.Estado.REGISTRADO, Animal.Estado.MODIFICADO],
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

        # ── Socios ────────────────────────────────────────────────────────────
        socios_qs = Socio.all_objects.filter(tenant=tenant)
        socios_alta = socios_qs.filter(estado=Socio.Estado.ALTA).count()
        socios_baja = socios_qs.filter(estado=Socio.Estado.BAJA).count()

        cuota_corriente = socios_qs.filter(
            estado=Socio.Estado.ALTA, cuota_anual_pagada__gte=year_now
        ).count()

        # Portal access counts (socios en alta únicamente)
        socios_alta_qs = socios_qs.filter(estado=Socio.Estado.ALTA)
        portal_active = socios_alta_qs.filter(
            user__isnull=False
        ).exclude(user__password__startswith="!").count()
        portal_pending = socios_alta_qs.filter(
            user__isnull=False,
            user__password__startswith="!",
            user__reset_token__isnull=False,
        ).count()
        portal_none = socios_alta - portal_active - portal_pending

        # Socios en alta sin cuota del año en curso (máx. 10 para el widget)
        socios_sin_cuota = list(
            socios_alta_qs.filter(
                cuota_anual_pagada__lt=year_now
            ).order_by("numero_socio")
            .values("id", "nombre_razon_social", "numero_socio")[:10]
        )

        # ── Animales ──────────────────────────────────────────────────────────
        animals_qs = Animal.all_objects.filter(tenant=tenant)
        animales_aprobados = animals_qs.filter(
            estado__in=[Animal.Estado.APROBADO, Animal.Estado.EVALUADO]
        ).count()
        animales_pendientes = animals_qs.filter(
            estado__in=[Animal.Estado.REGISTRADO, Animal.Estado.MODIFICADO]
        ).count()
        animales_rechazados = animals_qs.filter(estado=Animal.Estado.RECHAZADO).count()
        animales_baja = animals_qs.filter(
            estado__in=[Animal.Estado.BAJA, Animal.Estado.SOCIO_EN_BAJA]
        ).count()
        animales_activos = animales_aprobados + animales_pendientes
        animales_total = animals_qs.count()

        return Response({
            # tareas pendientes (retrocompatibilidad)
            "pendientes_aprobacion": pendientes_aprobacion,
            "conflictos_pendientes": conflictos_pendientes,
            "imports_pendientes": imports_pendientes,
            "candidatos_reproductor": candidatos_reproductor,
            "alertas_anilla": alertas_anilla,
            "solicitudes_realta": solicitudes_realta,
            # socios
            "socios_alta": socios_alta,
            "socios_baja": socios_baja,
            "cuota_corriente": cuota_corriente,
            "cuota_year": year_now,
            "portal_active": portal_active,
            "portal_pending": portal_pending,
            "portal_none": portal_none,
            "socios_sin_cuota": socios_sin_cuota,
            # animales
            "animales_activos": animales_activos,
            "animales_aprobados": animales_aprobados,
            "animales_pendientes": animales_pendientes,
            "animales_rechazados": animales_rechazados,
            "animales_baja": animales_baja,
            "animales_total": animales_total,
        })
