"""
Public catalog of approved reproductores.
"""
from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.animals.models import Animal
from apps.animals.serializers import AnimalDetailSerializer


class ReproductorListView(generics.ListAPIView):
    """
    Public endpoint listing all animals marked as reproductor_aprobado.
    Requires X-Tenant-Slug header to scope catalog per association.
    """
    serializer_class = AnimalDetailSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Animal.objects.filter(
            reproductor_aprobado=True,
        ).select_related("socio", "padre", "madre_animal").order_by("variedad", "numero_anilla")
