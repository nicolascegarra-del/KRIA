from rest_framework import serializers
from .models import TablaControl, TablaColumna, TablaEntrada


class TablaColumnaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TablaColumna
        fields = ["id", "nombre", "tipo", "orden"]


class TablaControlListSerializer(serializers.ModelSerializer):
    columnas_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = TablaControl
        fields = ["id", "nombre", "socio_columns", "columnas_count", "created_at", "updated_at"]


class TablaControlDetailSerializer(serializers.ModelSerializer):
    columnas = TablaColumnaSerializer(many=True, read_only=True)

    class Meta:
        model = TablaControl
        fields = ["id", "nombre", "socio_columns", "columnas", "created_at", "updated_at"]


class TablaControlWriteSerializer(serializers.ModelSerializer):
    columnas = TablaColumnaSerializer(many=True)

    class Meta:
        model = TablaControl
        fields = ["nombre", "socio_columns", "columnas"]

    def create(self, validated_data):
        columnas_data = validated_data.pop("columnas", [])
        tabla = TablaControl.objects.create(**validated_data)
        for i, col in enumerate(columnas_data):
            col.setdefault("orden", i)
            TablaColumna.objects.create(tabla=tabla, **col)
        # Create one TablaEntrada per active socio in the tenant
        from apps.accounts.models import Socio
        socios = Socio.objects.filter(tenant=tabla.tenant)
        TablaEntrada.objects.bulk_create([
            TablaEntrada(tabla=tabla, socio=s, valores={})
            for s in socios
        ])
        return tabla

    def update(self, instance, validated_data):
        columnas_data = validated_data.pop("columnas", None)
        instance.nombre = validated_data.get("nombre", instance.nombre)
        instance.socio_columns = validated_data.get("socio_columns", instance.socio_columns)
        instance.save()

        if columnas_data is not None:
            # Replace all columns: delete old, create new
            instance.columnas.all().delete()
            for i, col in enumerate(columnas_data):
                col.setdefault("orden", i)
                TablaColumna.objects.create(tabla=instance, **col)
            # Clear column values in entries that no longer exist
            # (new entries will have empty JSON; old values for deleted columns are dropped)
            new_col_ids = set(
                str(c.id) for c in instance.columnas.all()
            )
            for entrada in instance.entradas.all():
                cleaned = {k: v for k, v in entrada.valores.items() if k in new_col_ids}
                if cleaned != entrada.valores:
                    entrada.valores = cleaned
                    entrada.save(update_fields=["valores", "updated_at"])

        return instance


class TablaEntradaSerializer(serializers.ModelSerializer):
    socio_id = serializers.UUIDField(source="socio.id", read_only=True)
    socio_numero = serializers.CharField(source="socio.numero_socio", read_only=True)
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    socio_dni = serializers.CharField(source="socio.dni_nif", read_only=True)
    socio_email = serializers.SerializerMethodField()
    socio_telefono = serializers.CharField(source="socio.telefono", read_only=True)
    socio_municipio = serializers.CharField(source="socio.municipio", read_only=True)
    socio_provincia = serializers.CharField(source="socio.provincia", read_only=True)
    socio_estado = serializers.CharField(source="socio.estado", read_only=True)
    socio_fecha_alta = serializers.DateField(source="socio.fecha_alta", read_only=True)
    socio_cuota_anual_pagada = serializers.IntegerField(source="socio.cuota_anual_pagada", read_only=True, allow_null=True)

    def get_socio_email(self, obj):
        return obj.socio.user.email if obj.socio.user_id else ""

    class Meta:
        model = TablaEntrada
        fields = [
            "id", "socio_id", "socio_numero", "socio_nombre", "socio_dni",
            "socio_email", "socio_telefono", "socio_municipio", "socio_provincia",
            "socio_estado", "socio_fecha_alta", "socio_cuota_anual_pagada",
            "valores", "updated_at",
        ]
