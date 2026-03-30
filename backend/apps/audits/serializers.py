from decimal import Decimal

from rest_framework import serializers

from .models import (
    AuditoriaAnimal,
    AuditoriaRespuesta,
    AuditoriaSession,
    CriterioEvaluacion,
    PreguntaInstalacion,
)


# ── Configuración ──────────────────────────────────────────────────────────────

class CriterioEvaluacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriterioEvaluacion
        fields = ["id", "nombre", "descripcion", "multiplicador", "is_active", "orden"]


class PreguntaInstalacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreguntaInstalacion
        fields = ["id", "texto", "tipo", "is_active", "orden"]


# ── Auditoría ──────────────────────────────────────────────────────────────────

class AuditoriaAnimalSerializer(serializers.ModelSerializer):
    animal_anilla = serializers.SerializerMethodField()
    porcentaje = serializers.SerializerMethodField()

    class Meta:
        model = AuditoriaAnimal
        fields = [
            "id", "animal", "animal_anilla", "numero_anilla_manual",
            "puntuaciones", "puntuacion_total", "puntuacion_maxima",
            "porcentaje", "notas", "created_at",
        ]
        read_only_fields = ["puntuacion_total", "puntuacion_maxima", "created_at"]

    def get_animal_anilla(self, obj):
        if obj.animal:
            return obj.animal.numero_anilla
        return obj.numero_anilla_manual or None

    def get_porcentaje(self, obj):
        if obj.puntuacion_maxima and obj.puntuacion_maxima > 0:
            return round(float(obj.puntuacion_total / obj.puntuacion_maxima * 100), 1)
        return None


class AuditoriaRespuestaSerializer(serializers.ModelSerializer):
    pregunta_texto = serializers.CharField(source="pregunta.texto", read_only=True)
    pregunta_tipo = serializers.CharField(source="pregunta.tipo", read_only=True)

    class Meta:
        model = AuditoriaRespuesta
        fields = ["id", "pregunta", "pregunta_texto", "pregunta_tipo", "respuesta"]


class AuditoriaSessionSerializer(serializers.ModelSerializer):
    socio_nombre = serializers.CharField(source="socio.nombre_razon_social", read_only=True)
    animales_count = serializers.SerializerMethodField()

    class Meta:
        model = AuditoriaSession
        fields = [
            "id", "socio", "socio_nombre",
            "fecha_planificada", "fecha_realizacion",
            "estado", "auditores", "notas_generales",
            "animales_count", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_animales_count(self, obj):
        return obj.animales_evaluados.count()


class AuditoriaSessionDetailSerializer(AuditoriaSessionSerializer):
    """Full detail including evaluated animals and installation answers."""
    animales_evaluados = AuditoriaAnimalSerializer(many=True, read_only=True)
    respuestas_instalacion = AuditoriaRespuestaSerializer(many=True, read_only=True)

    class Meta(AuditoriaSessionSerializer.Meta):
        fields = AuditoriaSessionSerializer.Meta.fields + [
            "animales_evaluados", "respuestas_instalacion",
        ]
