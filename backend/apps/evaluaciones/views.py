from rest_framework import generics
from core.permissions import IsGestion
from .models import Evaluacion
from .serializers import EvaluacionSerializer


class EvaluacionListCreateView(generics.ListCreateAPIView):
    serializer_class = EvaluacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Evaluacion.objects.select_related("animal", "evaluador").all()

    def perform_create(self, serializer):
        serializer.save(
            tenant=self.request.tenant,
            evaluador=self.request.user,
        )


class EvaluacionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = EvaluacionSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return Evaluacion.objects.select_related("animal", "evaluador").all()
