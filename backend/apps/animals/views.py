"""
Animal API views including smart registration and state machine actions.
"""
from django.db import IntegrityError
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import django_filters

from core.permissions import IsGestion, IsSocioOrGestion, IsSocioOwner
from .models import Animal
from .serializers import (
    AnimalDetailSerializer,
    AnimalListSerializer,
    AnimalWriteSerializer,
    GenealogySerializer,
)
from apps.conflicts.models import Conflicto


class AnimalFilter(django_filters.FilterSet):
    estado = django_filters.CharFilter()
    variedad = django_filters.CharFilter()
    sexo = django_filters.CharFilter()
    anio = django_filters.NumberFilter(field_name="anio_nacimiento")

    class Meta:
        model = Animal
        fields = ["estado", "variedad", "sexo", "anio_nacimiento"]


class AnimalListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filterset_class = AnimalFilter
    search_fields = ["numero_anilla"]
    ordering_fields = ["created_at", "anio_nacimiento", "numero_anilla"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return AnimalListSerializer
        return AnimalWriteSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Animal.objects.select_related("socio", "padre", "madre_animal")
        if not (user.is_gestion or user.is_superadmin):
            # Socios only see their own animals
            try:
                qs = qs.filter(socio=user.socio)
            except Exception:
                return Animal.objects.none()
        return qs

    def create(self, request, *args, **kwargs):
        """Smart registration logic."""
        tenant = request.tenant
        user = request.user

        # Determine socio
        if user.is_gestion or user.is_superadmin:
            socio_id = request.data.get("socio")
            if not socio_id:
                return Response({"socio": "Required for gestión users."}, status=400)
            from apps.accounts.models import Socio
            try:
                socio = Socio.objects.get(pk=socio_id, tenant=tenant)
            except Socio.DoesNotExist:
                return Response({"socio": "Not found."}, status=404)
        else:
            try:
                socio = user.socio
            except Exception:
                return Response({"detail": "No socio profile found."}, status=400)

        anilla = request.data.get("numero_anilla")
        anio = request.data.get("anio_nacimiento")

        if not anilla or not anio:
            return Response({"detail": "numero_anilla and anio_nacimiento are required."}, status=400)

        # Global search (bypass tenant filter)
        existing = Animal.all_objects.filter(
            numero_anilla=anilla,
            anio_nacimiento=anio,
        ).first()

        if existing is None:
            # Scenario 1: New animal
            serializer = AnimalWriteSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            animal = serializer.save(tenant=tenant, socio=socio)
            return Response(AnimalDetailSerializer(animal).data, status=201)

        if str(existing.socio_id) == str(socio.id):
            # Scenario 2: Same socio — update
            serializer = AnimalWriteSerializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            existing._editing_user = user
            animal = serializer.save()
            return Response(AnimalDetailSerializer(animal).data, status=200)

        # Different socio
        from apps.accounts.models import Socio as SocioModel
        current_socio = existing.socio

        if current_socio.estado == SocioModel.Estado.BAJA:
            # Scenario 3: Transfer ownership
            existing.socio = socio
            existing.tenant = tenant
            existing.fotos = []
            existing.estado = Animal.Estado.AÑADIDO
            existing.save()
            return Response(AnimalDetailSerializer(existing).data, status=200)

        # Scenario 4: Conflict — current owner is ALTA
        conflict, _ = Conflicto.objects.get_or_create(
            tenant=tenant,
            numero_anilla=anilla,
            anio_nacimiento=anio,
            socio_reclamante=socio,
            defaults={
                "socio_actual": current_socio,
                "estado": Conflicto.Estado.PENDIENTE,
            },
        )
        return Response(
            {
                "detail": "Animal belongs to another active socio. Conflict registered.",
                "conflict_id": str(conflict.id),
            },
            status=409,
        )


class AnimalDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsSocioOwner]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return AnimalDetailSerializer
        return AnimalWriteSerializer

    def get_queryset(self):
        return Animal.objects.select_related("socio", "padre", "madre_animal", "madre_lote")

    def perform_update(self, serializer):
        serializer.instance._editing_user = self.request.user
        serializer.save()


class AnimalApproveView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if animal.estado not in (Animal.Estado.AÑADIDO, Animal.Estado.RECHAZADO):
            return Response({"detail": f"Cannot approve animal in state {animal.estado}."}, status=400)

        animal.estado = Animal.Estado.APROBADO
        animal.razon_rechazo = ""
        animal.save(update_fields=["estado", "razon_rechazo"])
        return Response(AnimalDetailSerializer(animal).data)


class AnimalRejectView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        razon = request.data.get("razon_rechazo", "")
        animal.estado = Animal.Estado.RECHAZADO
        animal.razon_rechazo = razon
        animal.save(update_fields=["estado", "razon_rechazo"])
        return Response(AnimalDetailSerializer(animal).data)


class AnimalGenealogyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            animal = Animal.objects.select_related(
                "padre", "padre__padre", "padre__madre_animal",
                "madre_animal", "madre_animal__padre", "madre_animal__madre_animal",
            ).get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return Response(GenealogySerializer(animal).data)


class AnimalGlobalSearchView(APIView):
    """Pre-check before smart registration."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        anilla = request.query_params.get("anilla")
        anio = request.query_params.get("anio")
        if not anilla or not anio:
            return Response({"detail": "anilla and anio params required."}, status=400)

        animal = Animal.all_objects.filter(
            numero_anilla=anilla, anio_nacimiento=anio
        ).select_related("socio", "tenant").first()

        if animal is None:
            return Response({"found": False})

        return Response({
            "found": True,
            "id": str(animal.id),
            "socio_id": str(animal.socio_id),
            "socio_nombre": animal.socio.nombre_razon_social,
            "socio_estado": animal.socio.estado,
            "tenant_slug": animal.tenant.slug,
            "estado": animal.estado,
        })
