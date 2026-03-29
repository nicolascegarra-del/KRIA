from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.permissions import IsGestion
from .models import Evaluacion
from .serializers import EvaluacionSerializer


class EvaluacionListCreateView(generics.ListCreateAPIView):
    serializer_class = EvaluacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        # Scope queryset to the active tenant (TenantManager uses thread-local,
        # but explicit filter via request.tenant is safer for clarity)
        return Evaluacion.objects.select_related("animal", "evaluador").filter(
            tenant=self.request.tenant
        )

    def perform_create(self, serializer):
        tenant = self.request.tenant
        animal = serializer.validated_data.get("animal")

        # Cross-tenant guard: the evaluated animal must belong to this tenant
        if animal and animal.tenant_id != tenant.id:
            raise PermissionDenied("El animal no pertenece a este tenant.")

        serializer.save(
            tenant=tenant,
            evaluador=self.request.user,
        )


class EvaluacionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = EvaluacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Evaluacion.objects.select_related("animal", "evaluador").filter(
            tenant=self.request.tenant
        )
