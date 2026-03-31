from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsGestion, IsSuperAdmin

from .models import (
    AuditoriaAnimal,
    AuditoriaRespuesta,
    AuditoriaSession,
    CriterioEvaluacion,
    PreguntaInstalacion,
)
from .serializers import (
    AuditoriaAnimalSerializer,
    AuditoriaRespuestaSerializer,
    AuditoriaSessionDetailSerializer,
    AuditoriaSessionSerializer,
    CriterioEvaluacionSerializer,
    PreguntaInstalacionSerializer,
)


# ── Configuración (gestión edita la de su tenant) ─────────────────────────────

class CriterioEvaluacionListCreateView(generics.ListCreateAPIView):
    serializer_class = CriterioEvaluacionSerializer
    permission_classes = [IsGestion]
    pagination_class = None

    def get_queryset(self):
        return CriterioEvaluacion.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


class CriterioEvaluacionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CriterioEvaluacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return CriterioEvaluacion.objects.filter(tenant=self.request.tenant)


class PreguntaInstalacionListCreateView(generics.ListCreateAPIView):
    serializer_class = PreguntaInstalacionSerializer
    permission_classes = [IsGestion]
    pagination_class = None

    def get_queryset(self):
        return PreguntaInstalacion.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


class PreguntaInstalacionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PreguntaInstalacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return PreguntaInstalacion.objects.filter(tenant=self.request.tenant)


# ── Auditorías ────────────────────────────────────────────────────────────────

class AuditoriaSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = AuditoriaSessionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        qs = AuditoriaSession.objects.filter(
            tenant=self.request.tenant
        ).select_related("socio").prefetch_related("animales_evaluados")
        socio_id = self.request.query_params.get("socio")
        if socio_id:
            qs = qs.filter(socio_id=socio_id)
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)


class AuditoriaSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsGestion]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return AuditoriaSessionDetailSerializer
        return AuditoriaSessionSerializer

    def get_queryset(self):
        return AuditoriaSession.objects.filter(
            tenant=self.request.tenant
        ).select_related("socio").prefetch_related(
            "animales_evaluados__animal",
            "respuestas_instalacion__pregunta",
        )


# ── Animales evaluados ────────────────────────────────────────────────────────

class AuditoriaAnimalListCreateView(generics.ListCreateAPIView):
    serializer_class = AuditoriaAnimalSerializer
    permission_classes = [IsGestion]

    def _get_auditoria(self):
        return AuditoriaSession.objects.get(
            pk=self.kwargs["auditoria_pk"],
            tenant=self.request.tenant,
        )

    def get_queryset(self):
        return AuditoriaAnimal.objects.filter(
            auditoria_id=self.kwargs["auditoria_pk"],
            auditoria__tenant=self.request.tenant,
        ).select_related("animal")

    def perform_create(self, serializer):
        auditoria = self._get_auditoria()
        serializer.save(auditoria=auditoria)


class AuditoriaAnimalDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AuditoriaAnimalSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return AuditoriaAnimal.objects.filter(
            auditoria_id=self.kwargs["auditoria_pk"],
            auditoria__tenant=self.request.tenant,
        ).select_related("animal")


# ── Respuestas instalación ────────────────────────────────────────────────────

class AuditoriaRespuestaBulkView(APIView):
    """
    POST: recibe lista [{pregunta, respuesta}, ...] y hace upsert de todas.
    GET: devuelve todas las respuestas de la auditoría.
    """
    permission_classes = [IsGestion]

    def _get_auditoria(self, request, auditoria_pk):
        return AuditoriaSession.objects.get(pk=auditoria_pk, tenant=request.tenant)

    def get(self, request, auditoria_pk):
        auditoria = self._get_auditoria(request, auditoria_pk)
        qs = AuditoriaRespuesta.objects.filter(auditoria=auditoria).select_related("pregunta")
        return Response(AuditoriaRespuestaSerializer(qs, many=True).data)

    def post(self, request, auditoria_pk):
        auditoria = self._get_auditoria(request, auditoria_pk)
        items = request.data if isinstance(request.data, list) else []
        saved = []
        for item in items:
            pregunta_id = item.get("pregunta")
            respuesta = item.get("respuesta", "")
            if not pregunta_id:
                continue
            obj, _ = AuditoriaRespuesta.objects.update_or_create(
                auditoria=auditoria,
                pregunta_id=pregunta_id,
                defaults={"respuesta": respuesta},
            )
            saved.append(obj)
        return Response(
            AuditoriaRespuestaSerializer(saved, many=True).data,
            status=status.HTTP_200_OK,
        )


# ── SuperAdmin: configurar criterios/preguntas para cualquier tenant ──────────

def _get_tenant(tenant_pk):
    from apps.tenants.models import Tenant
    try:
        return Tenant.objects.get(pk=tenant_pk)
    except Tenant.DoesNotExist:
        raise NotFound("Tenant no encontrado.")


class SuperAdminCriteriosView(generics.ListCreateAPIView):
    serializer_class = CriterioEvaluacionSerializer
    permission_classes = [IsSuperAdmin]
    pagination_class = None

    def get_queryset(self):
        return CriterioEvaluacion.all_objects.filter(tenant_id=self.kwargs["tenant_pk"])

    def perform_create(self, serializer):
        tenant = _get_tenant(self.kwargs["tenant_pk"])
        serializer.save(tenant=tenant)


class SuperAdminCriterioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CriterioEvaluacionSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return CriterioEvaluacion.all_objects.filter(tenant_id=self.kwargs["tenant_pk"])


class SuperAdminPreguntasView(generics.ListCreateAPIView):
    serializer_class = PreguntaInstalacionSerializer
    permission_classes = [IsSuperAdmin]
    pagination_class = None

    def get_queryset(self):
        return PreguntaInstalacion.all_objects.filter(tenant_id=self.kwargs["tenant_pk"])

    def perform_create(self, serializer):
        tenant = _get_tenant(self.kwargs["tenant_pk"])
        serializer.save(tenant=tenant)


class SuperAdminPreguntaDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PreguntaInstalacionSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return PreguntaInstalacion.all_objects.filter(tenant_id=self.kwargs["tenant_pk"])
