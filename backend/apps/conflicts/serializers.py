from rest_framework import serializers
from .models import Conflicto


class ConflictoSerializer(serializers.ModelSerializer):
    socio_reclamante_nombre = serializers.CharField(source="socio_reclamante.nombre_razon_social", read_only=True)
    socio_actual_nombre = serializers.CharField(source="socio_actual.nombre_razon_social", read_only=True)

    class Meta:
        model = Conflicto
        fields = "__all__"
        read_only_fields = ["id", "tenant", "created_at"]
