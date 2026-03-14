from rest_framework import serializers
from .models import Conflicto, SolicitudRealta


class ConflictoSerializer(serializers.ModelSerializer):
    socio_reclamante_nombre = serializers.CharField(source="socio_reclamante.nombre_razon_social", read_only=True)
    socio_actual_nombre = serializers.CharField(source="socio_actual.nombre_razon_social", read_only=True)

    class Meta:
        model = Conflicto
        fields = "__all__"
        read_only_fields = ["id", "tenant", "created_at"]


class SolicitudRealtaSerializer(serializers.ModelSerializer):
    animal_anilla = serializers.CharField(source="animal.numero_anilla", read_only=True)
    animal_anio = serializers.IntegerField(source="animal.anio_nacimiento", read_only=True)
    solicitante_nombre = serializers.CharField(source="solicitante.nombre_razon_social", read_only=True)

    class Meta:
        model = SolicitudRealta
        fields = [
            "id", "animal", "animal_anilla", "animal_anio",
            "solicitante", "solicitante_nombre",
            "estado", "notas", "created_at", "resolved_at",
        ]
        read_only_fields = ["id", "tenant", "created_at", "resolved_at"]
