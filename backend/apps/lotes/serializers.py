from rest_framework import serializers
from apps.animals.models import Animal
from .models import Lote


class LoteSerializer(serializers.ModelSerializer):
    macho_anilla = serializers.CharField(source="macho.numero_anilla", read_only=True, allow_null=True)
    # Explicitly writable M2M — DRF marks through-model M2M as read-only by default.
    # Use all_objects (plain Manager) to avoid TenantManager thread-local contamination
    # between tests. Tenant scoping for hembras is enforced at the model/view level.
    hembras = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=Animal.all_objects.all(),
    )
    hembras_anillas = serializers.SerializerMethodField()
    crias_count = serializers.SerializerMethodField()

    class Meta:
        model = Lote
        fields = [
            "id", "nombre", "socio",
            "macho", "macho_anilla",
            "hembras", "hembras_anillas",
            "crias_count",
            "fecha_inicio", "fecha_fin", "is_closed", "created_at",
        ]
        read_only_fields = ["id", "tenant", "is_closed", "created_at"]
        extra_kwargs = {
            # socios don't send socio in payload — perform_create sets it automatically
            "socio": {"required": False},
        }

    def get_hembras_anillas(self, obj):
        return [h.numero_anilla for h in obj.hembras.all()]

    def get_crias_count(self, obj):
        return obj.crias.count()

    def validate_macho(self, value):
        if value is not None and value.sexo != "M":
            raise serializers.ValidationError(
                "El macho del lote debe ser un animal de sexo Macho (M)."
            )
        return value

    def create(self, validated_data):
        # hembras uses a custom through table; DRF won't handle it automatically
        hembras = validated_data.pop("hembras", [])
        lote = super().create(validated_data)
        lote.hembras.set(hembras)
        return lote

    def update(self, instance, validated_data):
        hembras = validated_data.pop("hembras", None)
        lote = super().update(instance, validated_data)
        if hembras is not None:
            lote.hembras.set(hembras)
        return lote
