from django.contrib import admin
from .models import EntregaAnillas


@admin.register(EntregaAnillas)
class EntregaAnillasAdmin(admin.ModelAdmin):
    list_display = ["tenant", "socio", "anio_campana", "rango_inicio", "rango_fin", "diametro"]
    list_filter = ["tenant", "anio_campana", "diametro"]
