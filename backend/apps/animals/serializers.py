"""
Animal serializers including genealogy tree builder.
"""
from rest_framework import serializers
from .models import Animal

FOTO_TIPOS = ("PERFIL", "CABEZA", "ANILLA")


def _resolve_foto_url(foto: dict) -> dict:
    """
    Return a foto dict with a fresh presigned URL generated from the stored key.

    Formats handled:
    - Sprint 1+: {"tipo": "PERFIL", "key": "...", "uploaded_at": "..."}
    - Sprint 0:  {"key": "...", "uploaded_at": "..."}  (tipo → None)
    - Pre-S0:    {"url": "...", "key": "...", "uploaded_at": "..."}  (regenerates from key)
    - Very old:  no key → returned as-is
    """
    key = foto.get("key")
    if not key:
        return foto

    try:
        from apps.reports.storage import get_presigned_download_url
        url = get_presigned_download_url(key, expiry_hours=24)
    except Exception:
        url = f"/media/fallback/{key}"

    return {
        "tipo": foto.get("tipo"),  # None for pre-Sprint-1 entries
        "url": url,
        "key": key,
        "uploaded_at": foto.get("uploaded_at", ""),
    }


class AnimalListSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    granja_nombre = serializers.CharField(source="granja.nombre", read_only=True, allow_null=True)
    fotos = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "estado", "candidato_reproductor", "reproductor_aprobado",
            "alerta_anilla",
            "socio_nombre", "granja", "granja_nombre", "fotos", "created_at",
        ]

    def get_fotos(self, obj):
        return [_resolve_foto_url(f) for f in (obj.fotos or [])]


class AnimalDetailSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    padre_anilla = serializers.CharField(source="padre.numero_anilla", read_only=True, allow_null=True)
    padre_anio_nacimiento = serializers.IntegerField(source="padre.anio_nacimiento", read_only=True, allow_null=True)
    madre_anilla = serializers.CharField(source="madre_animal.numero_anilla", read_only=True, allow_null=True)
    madre_anio_nacimiento = serializers.IntegerField(source="madre_animal.anio_nacimiento", read_only=True, allow_null=True)
    granja_nombre = serializers.CharField(source="granja.nombre", read_only=True, allow_null=True)
    fotos = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "fecha_incubacion", "ganaderia_nacimiento", "ganaderia_actual",
            "estado", "razon_rechazo", "candidato_reproductor", "reproductor_aprobado",
            "alerta_anilla",
            "padre", "padre_anilla", "padre_anio_nacimiento", "madre_animal", "madre_anilla", "madre_anio_nacimiento", "madre_lote",
            "granja", "granja_nombre",
            "fotos", "historico_pesos", "socio_nombre",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "estado", "created_at", "updated_at"]

    def get_fotos(self, obj):
        return [_resolve_foto_url(f) for f in (obj.fotos or [])]


class AnimalWriteSerializer(serializers.ModelSerializer):
    # Fields for resolving padre/madre by anilla+año instead of UUID
    padre_anilla = serializers.CharField(write_only=True, required=False, allow_blank=True)
    padre_anio = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    madre_anilla = serializers.CharField(write_only=True, required=False, allow_blank=True)
    madre_anio = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Animal
        fields = [
            "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "fecha_incubacion", "ganaderia_nacimiento", "ganaderia_actual",
            "padre", "padre_anilla", "padre_anio",
            "madre_animal", "madre_anilla", "madre_anio",
            "madre_lote",
            "granja",
            "historico_pesos", "candidato_reproductor",
        ]
        # fotos: managed exclusively via /foto/ endpoint

    def _resolve_parent(self, anilla, anio, field_label):
        """Look up an Animal by anilla+año within the current tenant."""
        request = self.context.get("request")
        if not request or not hasattr(request, "tenant"):
            raise serializers.ValidationError(
                {field_label: "No se pudo determinar el tenant para resolver la anilla."}
            )
        try:
            return Animal.objects.get(
                numero_anilla=anilla,
                anio_nacimiento=anio,
                tenant=request.tenant,
            )
        except Animal.DoesNotExist:
            raise serializers.ValidationError(
                {field_label: f"No se encontró animal con anilla {anilla}/{anio}."}
            )

    def validate(self, data):
        # Resolve padre by anilla+año if provided
        padre_anilla = data.pop("padre_anilla", None)
        padre_anio = data.pop("padre_anio", None)
        madre_anilla = data.pop("madre_anilla", None)
        madre_anio = data.pop("madre_anio", None)

        if padre_anilla and padre_anio:
            data["padre"] = self._resolve_parent(padre_anilla, padre_anio, "padre_anilla")
        if madre_anilla and madre_anio:
            data["madre_animal"] = self._resolve_parent(madre_anilla, madre_anio, "madre_anilla")

        # madre_animal and madre_lote are mutually exclusive
        if data.get("madre_animal") and data.get("madre_lote"):
            raise serializers.ValidationError(
                "madre_animal and madre_lote are mutually exclusive."
            )

        # Bloquear cambio de variedad tras evaluación (solo socios, no gestión)
        request = self.context.get("request")
        if (
            self.instance is not None
            and "variedad" in data
            and data["variedad"] != self.instance.variedad
            and request is not None
        ):
            from core.permissions import get_effective_is_gestion
            if not get_effective_is_gestion(request):
                # evaluacion is OneToOneField (related_name="evaluacion")
                from apps.evaluaciones.models import Evaluacion
                has_eval = Evaluacion.objects.filter(animal=self.instance).exists()
                if has_eval:
                    raise serializers.ValidationError(
                        {"variedad": "No puedes cambiar la variedad de un animal ya evaluado."}
                    )

        return data


def _build_genealogy_node(animal, depth=0, max_depth=3):
    """Recursively build a 3-generation genealogy tree."""
    if animal is None or depth >= max_depth:
        return None

    # Resolve madre: individual animal or via lote
    madre_node = None
    if animal.madre_animal_id:
        madre_node = _build_genealogy_node(animal.madre_animal, depth + 1, max_depth)
    elif animal.madre_lote_id:
        lote = animal.madre_lote
        madre_node = {
            "id": str(lote.id),
            "anilla": lote.nombre,
            "anio": lote.fecha_inicio.year,
            "sexo": None,
            "variedad": None,
            "estado": None,
            "tipo": "LOTE",
            "padre": _build_genealogy_node(lote.macho, depth + 1, max_depth) if lote.macho else None,
            "madre": None,
        }

    return {
        "id": str(animal.id),
        "anilla": animal.numero_anilla,
        "anio": animal.anio_nacimiento,
        "sexo": animal.sexo,
        "variedad": animal.variedad,
        "estado": animal.estado,
        "tipo": "ANIMAL",
        "padre": _build_genealogy_node(animal.padre, depth + 1, max_depth),
        "madre": madre_node,
    }


class GenealogySerializer(serializers.ModelSerializer):
    tree = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = ["id", "numero_anilla", "anio_nacimiento", "sexo", "variedad", "tree"]

    def get_tree(self, obj):
        return _build_genealogy_node(obj)
