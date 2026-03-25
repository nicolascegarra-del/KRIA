from rest_framework import serializers
from .models import EntregaAnillas
from .utils import _to_int


def _ranges_overlap(a_ini, a_fin, b_ini, b_fin) -> bool:
    """True si los rangos [a_ini, a_fin] y [b_ini, b_fin] se solapan."""
    a_s, a_e = _to_int(a_ini), _to_int(a_fin)
    b_s, b_e = _to_int(b_ini), _to_int(b_fin)
    if all(v is not None for v in (a_s, a_e, b_s, b_e)):
        return a_s <= b_e and b_s <= a_e
    # Fallback lexicográfico
    return str(a_ini) <= str(b_fin) and str(b_ini) <= str(a_fin)


class EntregaAnillasSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    created_by_nombre = serializers.CharField(source="created_by.full_name", read_only=True, allow_null=True)
    sexo = serializers.SerializerMethodField()

    class Meta:
        model = EntregaAnillas
        fields = [
            "id", "tenant", "socio", "socio_nombre",
            "anio_campana", "rango_inicio", "rango_fin", "diametro", "sexo",
            "created_by", "created_by_nombre", "created_at",
        ]
        read_only_fields = ["id", "tenant", "created_by", "created_at"]

    def get_sexo(self, obj):
        """Devuelve el sexo asociado al diámetro según la configuración del tenant."""
        from apps.anillas.utils import _get_diametro_sexo
        mapping = _get_diametro_sexo(obj.tenant_id)
        return mapping.get(obj.diametro)

    def validate(self, data):
        inicio = data.get("rango_inicio", getattr(self.instance, "rango_inicio", None))
        fin = data.get("rango_fin", getattr(self.instance, "rango_fin", None))
        anio = data.get("anio_campana", getattr(self.instance, "anio_campana", None))
        diametro = data.get("diametro", getattr(self.instance, "diametro", None))

        # 1. Validar que fin >= inicio
        if inicio and fin:
            inicio_n = _to_int(inicio)
            fin_n = _to_int(fin)
            if inicio_n is not None and fin_n is not None:
                if inicio_n > fin_n:
                    raise serializers.ValidationError(
                        {"rango_fin": "rango_fin debe ser mayor o igual que rango_inicio."}
                    )
            elif str(inicio) > str(fin):
                raise serializers.ValidationError(
                    {"rango_fin": "rango_fin debe ser mayor o igual que rango_inicio."}
                )

        # 2. Validar que no haya solapamiento con rangos existentes
        if inicio and fin and anio and diametro:
            request = self.context.get("request")
            tenant = getattr(request, "tenant", None)
            if tenant is None and self.instance:
                tenant = self.instance.tenant

            if tenant:
                qs = EntregaAnillas.objects.filter(
                    tenant=tenant,
                    anio_campana=anio,
                    diametro=diametro,
                ).select_related("socio")
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)

                for e in qs:
                    if _ranges_overlap(inicio, fin, e.rango_inicio, e.rango_fin):
                        raise serializers.ValidationError(
                            {
                                "rango_inicio": (
                                    f"Conflicto: el rango {e.rango_inicio}–{e.rango_fin} "
                                    f"ya está asignado a {e.socio.nombre_razon_social} "
                                    f"(campaña {anio}, ∅{diametro}mm)."
                                )
                            }
                        )

        return data
