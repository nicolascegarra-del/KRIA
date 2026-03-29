from django.contrib import admin
from .models import Evaluacion


@admin.register(Evaluacion)
class EvaluacionAdmin(admin.ModelAdmin):
    list_display = ["animal", "puntuacion_media", "evaluador", "created_at"]
    list_filter = ["tenant"]
    raw_id_fields = ["animal"]
