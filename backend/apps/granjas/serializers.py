from rest_framework import serializers
from .models import Granja


class GranjaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Granja
        fields = ["id", "tenant", "socio", "nombre", "codigo_rega", "created_at"]
        # socio and tenant are always injected by the view — never required in the body
        read_only_fields = ["id", "tenant", "socio", "created_at"]


class GranjaReadSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(
        source="socio.nombre_razon_social", read_only=True
    )

    class Meta:
        model = Granja
        fields = ["id", "tenant", "socio", "socio_nombre", "nombre", "codigo_rega", "created_at"]
        read_only_fields = ["id", "tenant", "socio", "created_at"]
