from django.contrib import admin
from .models import Conflicto


@admin.register(Conflicto)
class ConflictoAdmin(admin.ModelAdmin):
    list_display = ["numero_anilla", "anio_nacimiento", "estado", "socio_reclamante", "created_at"]
    list_filter = ["tenant", "estado"]
