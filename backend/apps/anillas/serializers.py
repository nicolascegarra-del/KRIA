from rest_framework import serializers
from .models import EntregaAnillas


class EntregaAnillasSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    created_by_nombre = serializers.CharField(source="created_by.full_name", read_only=True, allow_null=True)

    class Meta:
        model = EntregaAnillas
        fields = [
            "id", "tenant", "socio", "socio_nombre",
            "anio_campana", "rango_inicio", "rango_fin", "diametro",
            "created_by", "created_by_nombre", "created_at",
        ]
        read_only_fields = ["id", "tenant", "created_by", "created_at"]

    def validate(self, data):
        inicio = data.get("rango_inicio", getattr(self.instance, "rango_inicio", None))
        fin = data.get("rango_fin", getattr(self.instance, "rango_fin", None))

        if inicio and fin:
            from apps.anillas.utils import _to_int
            inicio_n = _to_int(inicio)
            fin_n = _to_int(fin)
            if inicio_n is not None and fin_n is not None:
                if inicio_n > fin_n:
                    raise serializers.ValidationError(
                        {"rango_fin": "rango_fin debe ser mayor o igual que rango_inicio."}
                    )
            elif inicio > fin:
                raise serializers.ValidationError(
                    {"rango_fin": "rango_fin debe ser mayor o igual que rango_inicio."}
                )
        return data
