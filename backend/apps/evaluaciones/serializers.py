from rest_framework import serializers
from .models import Evaluacion


class EvaluacionSerializer(serializers.ModelSerializer):
    animal_anilla = serializers.CharField(source="animal.numero_anilla", read_only=True)
    animal_anio = serializers.IntegerField(source="animal.anio_nacimiento", read_only=True)
    puntuacion_media = serializers.DecimalField(max_digits=4, decimal_places=2, read_only=True)

    class Meta:
        model = Evaluacion
        fields = [
            "id", "animal", "animal_anilla", "animal_anio", "evaluador",
            "cabeza", "cola", "pecho_abdomen", "muslos_tarsos", "cresta_babilla", "color",
            "puntuacion_media",
            "picos_cresta", "color_orejilla", "color_general", "peso_evaluacion", "variedad_confirmada",
            "notas", "created_at",
        ]
        read_only_fields = ["id", "puntuacion_media", "created_at"]
