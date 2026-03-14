"""
Animal API views including smart registration and state machine actions.
"""
import io
import os
from datetime import datetime, timezone as dt_timezone
from uuid import uuid4


# ── Image MIME validation (no external deps) ──────────────────────────────────

def _is_allowed_image(data: bytes) -> bool:
    """Return True if the binary data starts with a known image magic header."""
    if len(data) < 4:
        return False
    if data[:3] == b'\xff\xd8\xff':
        return True
    if data[:4] == b'\x89PNG':
        return True
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return True
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return True
    return False


# ── Image optimization (Pillow) ───────────────────────────────────────────────

def _optimize_image(data: bytes, max_dimension: int = 1920, quality: int = 82) -> bytes:
    """
    Resize (if larger than max_dimension) and re-encode as progressive JPEG.
    - Strips EXIF metadata automatically.
    - Converts any color mode (RGBA, palette…) to RGB.
    - Returns optimized JPEG bytes.
    """
    from PIL import Image  # type: ignore

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out.getvalue()

from django.db import IntegrityError
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import django_filters

from core.permissions import IsGestion, IsSocioOrGestion, IsSocioOwner, get_effective_is_gestion
from core.throttles import UploadRateThrottle
from .models import Animal
from .serializers import (
    AnimalDetailSerializer,
    AnimalListSerializer,
    AnimalWriteSerializer,
    GenealogySerializer,
)
from apps.conflicts.models import Conflicto


def _update_alerta_anilla(animal):
    """Recomputa y guarda alerta_anilla en el animal. Llama tras create/update."""
    try:
        from apps.anillas.utils import compute_alerta_anilla
        alerta = compute_alerta_anilla(
            numero_anilla=animal.numero_anilla,
            anio=animal.anio_nacimiento,
            sexo=animal.sexo,
            socio_id=animal.socio_id,
            tenant_id=animal.tenant_id,
        )
    except Exception:
        alerta = ""
    if animal.alerta_anilla != alerta:
        animal.alerta_anilla = alerta
        animal.save(update_fields=["alerta_anilla"])


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
        if not get_effective_is_gestion(self.request):
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
        if get_effective_is_gestion(request):
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

        ctx = {"request": request}

        if existing is None:
            # Scenario 1: New animal
            serializer = AnimalWriteSerializer(data=request.data, context=ctx)
            serializer.is_valid(raise_exception=True)
            animal = serializer.save(tenant=tenant, socio=socio)
            _update_alerta_anilla(animal)
            return Response(AnimalDetailSerializer(animal, context=ctx).data, status=201)

        if str(existing.socio_id) == str(socio.id):
            # Scenario 2: Same socio — update
            serializer = AnimalWriteSerializer(existing, data=request.data, partial=True, context=ctx)
            serializer.is_valid(raise_exception=True)
            existing._editing_user = user
            animal = serializer.save()
            _update_alerta_anilla(animal)
            return Response(AnimalDetailSerializer(animal, context=ctx).data, status=200)

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
        animal = serializer.save()
        _update_alerta_anilla(animal)


FOTO_TIPOS_REQUERIDOS = {"PERFIL", "CABEZA", "ANILLA"}


class AnimalApproveView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if animal.estado not in (Animal.Estado.AÑADIDO, Animal.Estado.RECHAZADO):
            return Response({"detail": f"Cannot approve animal in state {animal.estado}."}, status=400)

        # Validate that all 3 required photo types are present
        tipos_presentes = {f.get("tipo") for f in (animal.fotos or []) if f.get("tipo")}
        faltantes = FOTO_TIPOS_REQUERIDOS - tipos_presentes
        if faltantes:
            return Response(
                {"detail": f"Faltan fotos obligatorias: {', '.join(sorted(faltantes))}."},
                status=400,
            )

        # Bloquear aprobación si hay alerta de diámetro (anilla no corresponde al sexo)
        if animal.alerta_anilla == "DIAMETRO":
            return Response(
                {"detail": "No se puede aprobar: el diámetro de la anilla no corresponde al sexo del animal."},
                status=400,
            )

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
                "madre_lote", "madre_lote__macho",
                "madre_lote__macho__padre", "madre_lote__macho__madre_animal",
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


class AnimalFotoUploadView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UploadRateThrottle]

    def _get_animal_and_check_perms(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return None, Response({"detail": "Not found."}, status=404)

        is_gestion = get_effective_is_gestion(request)
        if not is_gestion:
            try:
                if animal.socio != request.user.socio:
                    return None, Response({"detail": "Permission denied."}, status=403)
            except Exception:
                return None, Response({"detail": "Permission denied."}, status=403)

        return animal, None

    def post(self, request, pk):
        from apps.reports.storage import upload_bytes
        from .serializers import FOTO_TIPOS

        animal, err = self._get_animal_and_check_perms(request, pk)
        if err:
            return err

        foto = request.FILES.get("foto")
        if not foto:
            return Response({"detail": "No file provided."}, status=400)

        tipo = request.data.get("tipo", "").upper()
        if tipo not in FOTO_TIPOS:
            return Response(
                {"detail": f"tipo debe ser uno de: {', '.join(FOTO_TIPOS)}."},
                status=400,
            )

        # Read bytes once — needed for MIME check, optimization, and upload
        foto_bytes = foto.read()

        # ── Security: validate magic bytes ────────────────────────────────────
        if not _is_allowed_image(foto_bytes):
            return Response(
                {"detail": "Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG, GIF o WebP."},
                status=400,
            )

        # ── Optimization: resize + compress to JPEG (max 1920px, q=82) ───────
        try:
            foto_bytes = _optimize_image(foto_bytes)
        except Exception:
            pass  # If Pillow fails for any reason, upload the original

        # Always store as .jpg after optimization
        object_key = f"animals/{animal.tenant_id}/{animal.id}/{uuid4()}.jpg"

        # ── Store only the MinIO key (URL generated at read-time, never expires)
        upload_bytes(object_key, foto_bytes, content_type="image/jpeg")

        fotos = list(animal.fotos or [])
        # Replace existing photo of the same tipo (one per type enforced)
        fotos = [f for f in fotos if f.get("tipo") != tipo]
        fotos.append({
            "tipo": tipo,
            "key": object_key,
            "uploaded_at": datetime.now(dt_timezone.utc).isoformat(),
        })
        animal.fotos = fotos
        animal.save(update_fields=["fotos"])

        return Response(AnimalDetailSerializer(animal).data, status=201)

    def delete(self, request, pk):
        from apps.reports.storage import get_minio_client, ensure_bucket
        from django.conf import settings

        animal, err = self._get_animal_and_check_perms(request, pk)
        if err:
            return err

        key = request.data.get("key")
        if not key:
            return Response({"detail": "key is required."}, status=400)

        try:
            client = get_minio_client()
            client.remove_object(settings.MINIO_BUCKET_NAME, key)
        except Exception:
            pass  # If already deleted in MinIO, continue anyway

        animal.fotos = [f for f in (animal.fotos or []) if f.get("key") != key]
        animal.save(update_fields=["fotos"])

        return Response(AnimalDetailSerializer(animal).data)


class AnimalPesajeView(APIView):
    """POST /api/v1/animals/:id/pesaje/ — append a weight record."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Socios can only log weight for their own animals
        if not get_effective_is_gestion(request):
            try:
                if animal.socio != request.user.socio:
                    return Response({"detail": "Permission denied."}, status=403)
            except Exception:
                return Response({"detail": "Permission denied."}, status=403)

        fecha = request.data.get("fecha")
        peso = request.data.get("peso")

        if not fecha or peso is None:
            return Response({"detail": "fecha y peso son obligatorios."}, status=400)

        try:
            float(peso)
        except (TypeError, ValueError):
            return Response({"detail": "peso debe ser un número."}, status=400)

        entrada = {
            "fecha": fecha,
            "peso": float(peso),
            "usuario": request.user.full_name or request.user.email,
        }
        historico = list(animal.historico_pesos or [])
        historico.append(entrada)
        animal.historico_pesos = historico
        animal.save(update_fields=["historico_pesos"])

        return Response(AnimalDetailSerializer(animal).data, status=201)


class AnimalReproductorApproveView(APIView):
    """POST /api/v1/animals/:id/aprobar-reproductor/ — gestión aprueba o deniega candidato."""
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk, tenant=request.tenant)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        aprobado = request.data.get("aprobado")
        if aprobado is None:
            return Response({"detail": "El campo 'aprobado' es obligatorio (true/false)."}, status=400)

        if not isinstance(aprobado, bool):
            return Response({"detail": "El campo 'aprobado' debe ser un booleano."}, status=400)

        animal.reproductor_aprobado = aprobado
        if aprobado:
            animal.candidato_reproductor = True
        update_fields = ["reproductor_aprobado", "candidato_reproductor"]

        notas = request.data.get("notas_decision", "")
        if notas:
            animal.razon_rechazo = notas if not aprobado else ""
            update_fields.append("razon_rechazo")

        animal.save(update_fields=update_fields)
        return Response(AnimalDetailSerializer(animal).data)
