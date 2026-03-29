from django.contrib import admin
from .models import Lote


@admin.register(Lote)
class LoteAdmin(admin.ModelAdmin):
    list_display = ["nombre", "socio", "tenant", "fecha_inicio", "is_closed"]
    list_filter = ["tenant", "is_closed"]
