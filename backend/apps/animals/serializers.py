"""
Animal serializers including genealogy tree builder.
"""
from rest_framework import serializers
from .models import Animal, GanaderiaNacimientoMap, LoteExternoMap, MotivoBaja

FOTO_TIPOS = ("PERFIL", "CABEZA", "ANILLA")


def _resolve_foto_url(foto: dict) -> dict:
    key = foto.get("key")
    if not key:
        return foto

    try:
        from apps.reports.storage import get_presigned_download_url
        url = get_presigned_download_url(key, expiry_hours=24)
    except Exception:
        url = f"/media/fallback/{key}"

    return {
        "tipo": foto.get("tipo"),
        "url": url,
        "key": key,
        "uploaded_at": foto.get("uploaded_at", ""),
    }


class MotivoBajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoBaja
        fields = ["id", "nombre", "is_active", "orden"]


class AnimalListSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    granja_nombre = serializers.CharField(source="granja.nombre", read_only=True, allow_null=True)
    padre_anilla = serializers.CharField(source="padre.numero_anilla", read_only=True, allow_null=True)
    madre_anilla = serializers.SerializerMethodField()
    fotos = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "fecha_nacimiento", "sexo", "variedad",
            "estado", "candidato_reproductor", "reproductor_aprobado",
            "alerta_anilla",
            "socio_nombre", "granja", "granja_nombre",
            "padre_anilla", "madre_anilla",
            "fotos", "created_at",
        ]

    def get_fotos(self, obj):
        return [_resolve_foto_url(f) for f in (obj.fotos or [])]

    def get_madre_anilla(self, obj):
        if obj.madre_animal_id:
            return obj.madre_animal.numero_anilla if obj.madre_animal else None
        if obj.madre_lote_id:
            return obj.madre_lote.nombre if obj.madre_lote else None
        if obj.madre_lote_externo:
            return obj.madre_lote_externo
        return None


class AnimalDetailSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    padre_anilla = serializers.CharField(source="padre.numero_anilla", read_only=True, allow_null=True)
    padre_anio_nacimiento = serializers.SerializerMethodField()
    madre_anilla = serializers.CharField(source="madre_animal.numero_anilla", read_only=True, allow_null=True)
    madre_anio_nacimiento = serializers.SerializerMethodField()
    granja_nombre = serializers.CharField(source="granja.nombre", read_only=True, allow_null=True)
    motivo_baja_nombre = serializers.CharField(source="motivo_baja.nombre", read_only=True, allow_null=True)
    fotos = serializers.SerializerMethodField()
    ganaderia_nacimiento_display = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "fecha_nacimiento", "sexo", "variedad",
            "fecha_incubacion", "ganaderia_nacimiento", "ganaderia_nacimiento_display", "ganaderia_actual",
            "estado", "razon_rechazo", "candidato_reproductor", "reproductor_aprobado",
            "alerta_anilla",
            "fecha_baja", "motivo_baja", "motivo_baja_nombre",
            "padre", "padre_anilla", "padre_anio_nacimiento",
            "madre_animal", "madre_anilla", "madre_anio_nacimiento",
            "madre_lote", "madre_lote_externo",
            "granja", "granja_nombre",
            "fotos", "historico_pesos", "socio_nombre",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "estado", "created_at", "updated_at"]

    def get_fotos(self, obj):
        return [_resolve_foto_url(f) for f in (obj.fotos or [])]

    def get_padre_anio_nacimiento(self, obj):
        if obj.padre and obj.padre.fecha_nacimiento:
            return obj.padre.fecha_nacimiento.year
        return None

    def get_madre_anio_nacimiento(self, obj):
        if obj.madre_animal and obj.madre_animal.fecha_nacimiento:
            return obj.madre_animal.fecha_nacimiento.year
        return None

    def get_ganaderia_nacimiento_display(self, obj):
        """Devuelve el nombre del socio redirigido si existe mapeo, o el texto original."""
        if not obj.ganaderia_nacimiento:
            return ""
        try:
            mapping = GanaderiaNacimientoMap.objects.filter(
                tenant_id=obj.tenant_id,
                ganaderia_nombre=obj.ganaderia_nacimiento,
                socio_real__isnull=False,
            ).select_related("socio_real").first()
            if mapping and mapping.socio_real:
                return mapping.socio_real.nombre_razon_social
        except Exception:
            pass
        return obj.ganaderia_nacimiento


class AnimalWriteSerializer(serializers.ModelSerializer):
    # Fields for resolving padre/madre by anilla (year embedded in ring number)
    padre_anilla = serializers.CharField(write_only=True, required=False, allow_blank=True)
    madre_anilla = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Animal
        fields = [
            "numero_anilla", "fecha_nacimiento", "sexo", "variedad",
            "fecha_incubacion", "ganaderia_nacimiento",
            "padre", "padre_anilla",
            "madre_animal", "madre_anilla",
            "madre_lote", "madre_lote_externo",
            "granja",
            "historico_pesos", "candidato_reproductor",
        ]

    def _resolve_parent(self, anilla, field_label):
        """Look up an Animal by anilla within the current tenant. Year is embedded in the ring."""
        request = self.context.get("request")
        if not request or not hasattr(request, "tenant"):
            raise serializers.ValidationError(
                {field_label: "No se pudo determinar el tenant para resolver la anilla."}
            )
        qs = Animal.objects.filter(numero_anilla=anilla, tenant=request.tenant)
        animal = qs.first()
        if animal is None:
            raise serializers.ValidationError(
                {field_label: f"No se encontró animal con anilla '{anilla}' en esta asociación."}
            )
        return animal

    def validate(self, data):
        padre_anilla = data.pop("padre_anilla", None)
        madre_anilla = data.pop("madre_anilla", None)

        if padre_anilla:
            data["padre"] = self._resolve_parent(padre_anilla, "padre_anilla")
        if madre_anilla:
            data["madre_animal"] = self._resolve_parent(madre_anilla, "madre_anilla")

        # Validate exclusivity of madre fields
        madre_count = sum([
            bool(data.get("madre_animal")),
            bool(data.get("madre_lote")),
            bool(data.get("madre_lote_externo")),
        ])
        if madre_count > 1:
            raise serializers.ValidationError(
                "Solo puede especificarse un campo de madre: madre_animal, madre_lote o madre_lote_externo."
            )

        request = self.context.get("request")
        if (
            self.instance is not None
            and "variedad" in data
            and data["variedad"] != self.instance.variedad
            and request is not None
        ):
            from core.permissions import get_effective_is_gestion
            if not get_effective_is_gestion(request):
                from apps.evaluaciones.models import Evaluacion
                has_eval = Evaluacion.objects.filter(animal=self.instance).exists()
                if has_eval:
                    raise serializers.ValidationError(
                        {"variedad": "No puedes cambiar la variedad de un animal ya evaluado."}
                    )

        # Un animal solo puede proponerse como candidato reproductor si está APROBADO
        if data.get("candidato_reproductor") is True and self.instance is not None:
            from core.permissions import get_effective_is_gestion
            if request is None or not get_effective_is_gestion(request):
                if self.instance.estado != Animal.Estado.APROBADO:
                    raise serializers.ValidationError(
                        {"candidato_reproductor": "Solo puedes proponer como reproductor un animal en estado Aprobado."}
                    )

        return data


def _build_genealogy_node(animal, depth=0, max_depth=20, _visited=None):
    """Recursively build a full genealogy tree with cycle protection."""
    if animal is None or depth >= max_depth:
        return None

    if _visited is None:
        _visited = set()
    animal_id = str(animal.id)
    if animal_id in _visited:
        return None
    _visited = _visited | {animal_id}  # immutable copy per branch to allow shared ancestors

    madre_node = None
    if animal.madre_animal_id:
        madre_node = _build_genealogy_node(animal.madre_animal, depth + 1, max_depth, _visited)
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
            "padre": _build_genealogy_node(lote.macho, depth + 1, max_depth, _visited) if lote.macho else None,
            "madre": None,
        }
    elif animal.madre_lote_externo:
        madre_node = {
            "id": None,
            "anilla": animal.madre_lote_externo,
            "anio": None,
            "sexo": None,
            "variedad": None,
            "estado": None,
            "tipo": "LOTE_EXTERNO",
            "padre": None,
            "madre": None,
        }

    return {
        "id": str(animal.id),
        "anilla": animal.numero_anilla,
        "anio": animal.fecha_nacimiento.year if animal.fecha_nacimiento else None,
        "sexo": animal.sexo,
        "variedad": animal.variedad,
        "estado": animal.estado,
        "tipo": "ANIMAL",
        "padre": _build_genealogy_node(animal.padre, depth + 1, max_depth, _visited),
        "madre": madre_node,
    }


class GenealogySerializer(serializers.ModelSerializer):
    tree = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = ["id", "numero_anilla", "fecha_nacimiento", "sexo", "variedad", "tree"]

    def get_tree(self, obj):
        return _build_genealogy_node(obj)


class GanaderiaNacimientoMapSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio_real.nombre_razon_social", read_only=True, allow_null=True)
    animal_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = GanaderiaNacimientoMap
        fields = ["id", "ganaderia_nombre", "socio_real", "socio_nombre", "animal_count", "updated_at"]


class LoteExternoMapSerializer(serializers.ModelSerializer):
    lote_nombre = serializers.CharField(source="lote_real.nombre", read_only=True, allow_null=True)
    animal_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = LoteExternoMap
        fields = ["id", "descripcion", "lote_real", "lote_nombre", "animal_count", "updated_at"]
