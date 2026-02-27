"""
Animal serializers including genealogy tree builder.
"""
from rest_framework import serializers
from .models import Animal


class AnimalListSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "estado", "candidato_reproductor", "reproductor_aprobado",
            "socio_nombre", "fotos", "created_at",
        ]


class AnimalDetailSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    padre_anilla = serializers.CharField(source="padre.numero_anilla", read_only=True, allow_null=True)
    madre_anilla = serializers.CharField(source="madre_animal.numero_anilla", read_only=True, allow_null=True)

    class Meta:
        model = Animal
        fields = [
            "id", "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "estado", "razon_rechazo", "candidato_reproductor", "reproductor_aprobado",
            "padre", "padre_anilla", "madre_animal", "madre_anilla", "madre_lote",
            "fotos", "historico_pesos", "socio_nombre",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "estado", "created_at", "updated_at"]


class AnimalWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = [
            "numero_anilla", "anio_nacimiento", "sexo", "variedad",
            "padre", "madre_animal", "madre_lote",
            "fotos", "historico_pesos", "candidato_reproductor",
        ]

    def validate(self, data):
        if data.get("madre_animal") and data.get("madre_lote"):
            raise serializers.ValidationError(
                "madre_animal and madre_lote are mutually exclusive."
            )
        return data


def _build_genealogy_node(animal, depth=0, max_depth=3):
    """Recursively build a 3-generation genealogy tree."""
    if animal is None or depth >= max_depth:
        return None
    return {
        "id": str(animal.id),
        "anilla": animal.numero_anilla,
        "anio": animal.anio_nacimiento,
        "sexo": animal.sexo,
        "variedad": animal.variedad,
        "estado": animal.estado,
        "padre": _build_genealogy_node(animal.padre, depth + 1, max_depth),
        "madre": _build_genealogy_node(animal.madre_animal, depth + 1, max_depth),
    }


class GenealogySerializer(serializers.ModelSerializer):
    tree = serializers.SerializerMethodField()

    class Meta:
        model = Animal
        fields = ["id", "numero_anilla", "anio_nacimiento", "sexo", "variedad", "tree"]

    def get_tree(self, obj):
        return _build_genealogy_node(obj)
