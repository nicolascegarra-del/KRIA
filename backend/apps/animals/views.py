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
from .models import Animal, GanaderiaNacimientoMap, LoteExternoMap, MotivoBaja
from .serializers import (
    AnimalDetailSerializer,
    AnimalListSerializer,
    AnimalWriteSerializer,
    GanaderiaNacimientoMapSerializer,
    LoteExternoMapSerializer,
    GenealogySerializer,
    MotivoBajaSerializer,
)
from apps.conflicts.models import Conflicto


def _create_notificacion(tenant, socio, tipo, animal):
    """Create a notification for the socio's user. Never raises."""
    try:
        if not socio or not getattr(socio, "user_id", None):
            return
        from apps.accounts.models import Notificacion
        anilla = animal.numero_anilla if animal else ""
        mensajes = {
            "ANIMAL_APROBADO": f"Tu animal {anilla} ha sido aprobado.",
            "ANIMAL_RECHAZADO": f"Tu animal {anilla} ha sido rechazado.",
            "REALTA_APROBADA": f"La solicitud de re-alta de tu animal {anilla} ha sido aprobada.",
            "REALTA_DENEGADA": f"La solicitud de re-alta de tu animal {anilla} ha sido denegada.",
            "REPRODUCTOR_APROBADO": f"Tu animal {anilla} ha sido aprobado como reproductor.",
            "REPRODUCTOR_DENEGADO": f"Tu animal {anilla} no ha sido aprobado como reproductor.",
        }
        mensaje = mensajes.get(tipo, "")
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


def _update_alerta_anilla(animal):
    """Recomputa y guarda alerta_anilla en el animal. Llama tras create/update."""
    try:
        from apps.anillas.utils import compute_alerta_anilla
        alerta = compute_alerta_anilla(
            numero_anilla=animal.numero_anilla,
            anio=animal.fecha_nacimiento.year if animal.fecha_nacimiento else 0,
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
    anio = django_filters.NumberFilter(field_name="fecha_nacimiento", lookup_expr="year")
    socio_id = django_filters.UUIDFilter(field_name="socio__id")

    class Meta:
        model = Animal
        fields = ["estado", "variedad", "sexo", "socio"]


class AnimalListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filterset_class = AnimalFilter
    search_fields = ["numero_anilla"]
    ordering_fields = ["created_at", "fecha_nacimiento", "numero_anilla"]
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
        fecha_nacimiento = request.data.get("fecha_nacimiento")

        if not anilla or not fecha_nacimiento:
            return Response({"detail": "numero_anilla and fecha_nacimiento are required."}, status=400)

        # Global search (bypass tenant filter)
        existing = Animal.all_objects.filter(
            numero_anilla=anilla,
            fecha_nacimiento=fecha_nacimiento,
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
        anio_conflicto = int(str(fecha_nacimiento)[:4]) if fecha_nacimiento else 0
        conflict, _ = Conflicto.objects.get_or_create(
            tenant=tenant,
            numero_anilla=anilla,
            anio_nacimiento=anio_conflicto,
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
        from rest_framework.exceptions import PermissionDenied
        if not get_effective_is_gestion(self.request):
            if serializer.instance.estado == Animal.Estado.RECHAZADO:
                raise PermissionDenied("No puedes editar un animal rechazado. Contacta con la gestión.")
        serializer.instance._editing_user = self.request.user
        animal = serializer.save()
        _update_alerta_anilla(animal)


FOTO_TIPOS_REQUERIDOS = {"PERFIL", "CABEZA", "ANILLA"}


class AnimalApproveView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk, tenant=request.tenant)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if animal.estado not in (Animal.Estado.AÑADIDO, Animal.Estado.RECHAZADO):
            return Response({"detail": f"Cannot approve animal in state {animal.estado}."}, status=400)

        # Bloquear aprobación si hay alerta de diámetro (anilla no corresponde al sexo)
        if animal.alerta_anilla == "DIAMETRO":
            return Response(
                {"detail": "No se puede aprobar: el diámetro de la anilla no corresponde al sexo del animal."},
                status=400,
            )

        animal.estado = Animal.Estado.APROBADO
        animal.razon_rechazo = ""
        animal.save(update_fields=["estado", "razon_rechazo"])
        _create_notificacion(request.tenant, animal.socio, "ANIMAL_APROBADO", animal)
        return Response(AnimalDetailSerializer(animal).data)


class AnimalRejectView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk, tenant=request.tenant)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        razon = request.data.get("razon_rechazo", "")
        animal.estado = Animal.Estado.RECHAZADO
        animal.razon_rechazo = razon
        animal.save(update_fields=["estado", "razon_rechazo"])
        _create_notificacion(request.tenant, animal.socio, "ANIMAL_RECHAZADO", animal)
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

        if not get_effective_is_gestion(request):
            try:
                if animal.socio != request.user.socio:
                    return Response({"detail": "Not found."}, status=404)
            except Exception:
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
            numero_anilla=anilla, fecha_nacimiento__year=anio
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
        tipo_notif = "REPRODUCTOR_APROBADO" if aprobado else "REPRODUCTOR_DENEGADO"
        _create_notificacion(request.tenant, animal.socio, tipo_notif, animal)
        return Response(AnimalDetailSerializer(animal).data)


# Motivos de rechazo predefinidos por fase
MOTIVOS_RECHAZO = {
    "AÑADIDO": [
        "Documentación incompleta",
        "Foto de perfil ilegible",
        "Foto de cabeza ilegible",
        "Foto de anilla ilegible",
        "Anilla no legible en la imagen",
        "Datos genealógicos incorrectos",
        "Animal no identificable",
        "Otros",
    ],
    "APROBADO": [
        "No cumple estándar morfológico",
        "Variedad no confirmada",
        "Peso fuera de rango",
        "Defecto descalificante",
        "Documentación caducada",
        "Otros",
    ],
    "EVALUACION": [
        "Puntuación insuficiente (< 6 en media)",
        "Variedad no conforme con el estándar",
        "Estado sanitario deficiente",
        "Información insuficiente para evaluar",
        "Otros",
    ],
}


class AnimalMotivosRechazoView(APIView):
    """GET /api/v1/animals/motivos-rechazo/ — devuelve los motivos predefinidos por fase."""
    permission_classes = [IsGestion]

    def get(self, request):
        return Response(MOTIVOS_RECHAZO)


class AnimalSolicitarRealtaView(APIView):
    """POST /api/v1/animals/:id/solicitar-realta/ — socio solicita re-alta de su animal."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Solo el socio propietario puede solicitar re-alta
        if get_effective_is_gestion(request):
            return Response({"detail": "Solo los socios pueden solicitar re-alta."}, status=403)

        try:
            socio = request.user.socio
        except Exception:
            return Response({"detail": "No se encontró perfil de socio."}, status=400)

        if animal.socio != socio:
            return Response({"detail": "Permission denied."}, status=403)

        ESTADOS_NO_ACTIVOS = {
            Animal.Estado.SOCIO_EN_BAJA,
            Animal.Estado.BAJA,
            Animal.Estado.RECHAZADO,
        }
        if animal.estado not in ESTADOS_NO_ACTIVOS:
            return Response(
                {"detail": f"Solo se puede solicitar reactivación de animales no activos. Estado actual: {animal.estado}."},
                status=400,
            )

        from apps.conflicts.models import SolicitudRealta
        # Evitar solicitudes duplicadas pendientes
        if SolicitudRealta.all_objects.filter(
            animal=animal, estado=SolicitudRealta.Estado.PENDIENTE
        ).exists():
            return Response({"detail": "Ya existe una solicitud de re-alta pendiente para este animal."}, status=400)

        solicitud = SolicitudRealta.all_objects.create(
            tenant=request.tenant,
            animal=animal,
            solicitante=socio,
            estado=SolicitudRealta.Estado.PENDIENTE,
            notas=request.data.get("notas", ""),
        )

        from apps.conflicts.serializers import SolicitudRealtaSerializer
        return Response(SolicitudRealtaSerializer(solicitud).data, status=201)


class AnimalDarBajaView(APIView):
    """POST /api/v1/animals/:id/dar-baja/ — gestión o el propio socio da de baja un animal."""
    permission_classes = [IsSocioOrGestion]

    def post(self, request, pk):
        try:
            animal = Animal.objects.get(pk=pk, tenant=request.tenant)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Socios sólo pueden dar de baja sus propios animales
        if not get_effective_is_gestion(request):
            if not hasattr(request.user, "socio") or animal.socio != request.user.socio:
                return Response({"detail": "No tienes permiso para dar de baja este animal."}, status=403)

        if animal.estado == Animal.Estado.BAJA:
            return Response({"detail": "El animal ya está dado de baja."}, status=400)

        fecha_baja = request.data.get("fecha_baja")
        motivo_baja_id = request.data.get("motivo_baja")

        if not fecha_baja:
            return Response({"detail": "fecha_baja es obligatorio."}, status=400)
        if not motivo_baja_id:
            return Response({"detail": "motivo_baja es obligatorio."}, status=400)

        try:
            motivo = MotivoBaja.objects.get(pk=motivo_baja_id, tenant=request.tenant)
        except MotivoBaja.DoesNotExist:
            return Response({"detail": "Motivo de baja no encontrado."}, status=404)

        animal.estado = Animal.Estado.BAJA
        animal.fecha_baja = fecha_baja
        animal.motivo_baja = motivo
        animal.save(update_fields=["estado", "fecha_baja", "motivo_baja"])
        return Response(AnimalDetailSerializer(animal).data)


class AnimalReactivarView(APIView):
    """POST /api/v1/animals/:id/reactivar/ — gestión reactiva directamente un animal en baja."""
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            animal = Animal.all_objects.get(pk=pk, tenant=request.tenant)
        except Animal.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if animal.estado not in (Animal.Estado.BAJA, Animal.Estado.RECHAZADO, Animal.Estado.SOCIO_EN_BAJA):
            return Response({"detail": f"No se puede reactivar un animal en estado {animal.estado}."}, status=400)

        animal.estado = Animal.Estado.AÑADIDO
        animal.fecha_baja = None
        animal.motivo_baja = None
        animal.razon_rechazo = ""
        animal.save(update_fields=["estado", "fecha_baja", "motivo_baja", "razon_rechazo"])
        return Response(AnimalDetailSerializer(animal).data)


class MotivoBajaListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/configuracion/motivos-baja/
    GET: socios y gestión pueden leer (para el formulario de baja).
    POST: solo gestión puede crear.
    """
    serializer_class = MotivoBajaSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsSocioOrGestion()]
        return [IsGestion()]

    def get_queryset(self):
        return MotivoBaja.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


class MotivoBajaDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/configuracion/motivos-baja/:id/"""
    serializer_class = MotivoBajaSerializer
    permission_classes = [IsGestion]

    def get_queryset(self):
        return MotivoBaja.objects.filter(tenant=self.request.tenant)


# ── Ganadería de nacimiento remapping ─────────────────────────────────────────

class GanaderiasNacimientoView(APIView):
    """
    GET  /api/v1/animals/ganaderias-nacimiento/
         Returns all unique ganaderia_nacimiento values with animal count and current mapping.
    POST /api/v1/animals/ganaderias-nacimiento/
         Create or update a mapping: { ganaderia_nombre, socio_real (uuid|null) }
    """
    permission_classes = [IsGestion]

    def get(self, request):
        from django.db.models import Count, OuterRef, Subquery
        tenant = request.tenant

        # All unique ganaderia_nacimiento values (non-empty) with counts
        rows = (
            Animal.objects
            .filter(ganaderia_nacimiento__gt="")
            .values("ganaderia_nacimiento")
            .annotate(animal_count=Count("id"))
            .order_by("ganaderia_nacimiento")
        )

        # Fetch existing mappings
        maps = {
            m.ganaderia_nombre: m
            for m in GanaderiaNacimientoMap.objects.filter(tenant=tenant).select_related("socio_real")
        }

        result = []
        for row in rows:
            nombre = row["ganaderia_nombre"]
            mapping = maps.get(nombre)
            result.append({
                "ganaderia_nombre": nombre,
                "animal_count": row["animal_count"],
                "map_id": str(mapping.id) if mapping else None,
                "socio_real": str(mapping.socio_real_id) if mapping and mapping.socio_real_id else None,
                "socio_nombre": mapping.socio_real.nombre_razon_social if mapping and mapping.socio_real else None,
            })

        return Response(result)

    def post(self, request):
        tenant = request.tenant
        ganaderia_nombre = request.data.get("ganaderia_nombre", "").strip()
        socio_real_id = request.data.get("socio_real")  # uuid or null

        if not ganaderia_nombre:
            return Response({"detail": "ganaderia_nombre es obligatorio."}, status=400)

        from apps.accounts.models import Socio
        socio_real = None
        if socio_real_id:
            try:
                socio_real = Socio.objects.get(pk=socio_real_id, tenant=tenant)
            except Socio.DoesNotExist:
                return Response({"detail": "Socio no encontrado."}, status=404)

        mapping, _ = GanaderiaNacimientoMap.objects.update_or_create(
            tenant=tenant,
            ganaderia_nombre=ganaderia_nombre,
            defaults={"socio_real": socio_real},
        )
        return Response({
            "id": str(mapping.id),
            "ganaderia_nombre": mapping.ganaderia_nombre,
            "socio_real": str(mapping.socio_real_id) if mapping.socio_real_id else None,
            "socio_nombre": mapping.socio_real.nombre_razon_social if mapping.socio_real else None,
        })


# ── Lote externo remapping ─────────────────────────────────────────────────────

class LotesExternosView(APIView):
    """
    GET  /api/v1/animals/lotes-externos/
         Returns all unique madre_lote_externo values with animal count and current mapping.
    POST /api/v1/animals/lotes-externos/
         Create or update a mapping: { descripcion, lote_real (uuid|null) }
    """
    permission_classes = [IsGestion]

    def get(self, request):
        from django.db.models import Count
        tenant = request.tenant

        rows = (
            Animal.objects
            .filter(madre_lote_externo__gt="")
            .values("madre_lote_externo")
            .annotate(animal_count=Count("id"))
            .order_by("madre_lote_externo")
        )

        maps = {
            m.descripcion: m
            for m in LoteExternoMap.objects.filter(tenant=tenant).select_related("lote_real")
        }

        result = []
        for row in rows:
            desc = row["madre_lote_externo"]
            mapping = maps.get(desc)
            result.append({
                "descripcion": desc,
                "animal_count": row["animal_count"],
                "map_id": str(mapping.id) if mapping else None,
                "lote_real": str(mapping.lote_real_id) if mapping and mapping.lote_real_id else None,
                "lote_nombre": mapping.lote_real.nombre if mapping and mapping.lote_real else None,
            })

        return Response(result)

    def post(self, request):
        tenant = request.tenant
        descripcion = request.data.get("descripcion", "").strip()
        lote_real_id = request.data.get("lote_real")

        if not descripcion:
            return Response({"detail": "descripcion es obligatorio."}, status=400)

        from apps.lotes.models import Lote
        lote_real = None
        if lote_real_id:
            try:
                lote_real = Lote.objects.get(pk=lote_real_id, tenant=tenant)
            except Lote.DoesNotExist:
                return Response({"detail": "Lote no encontrado."}, status=404)

        mapping, _ = LoteExternoMap.objects.update_or_create(
            tenant=tenant,
            descripcion=descripcion,
            defaults={"lote_real": lote_real},
        )
        return Response({
            "id": str(mapping.id),
            "descripcion": mapping.descripcion,
            "lote_real": str(mapping.lote_real_id) if mapping.lote_real_id else None,
            "lote_nombre": mapping.lote_real.nombre if mapping.lote_real else None,
        })
