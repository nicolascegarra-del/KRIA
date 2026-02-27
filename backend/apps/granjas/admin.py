from django.contrib import admin
from .models import Granja


@admin.register(Granja)
class GranjaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "codigo_rega", "socio", "tenant", "created_at"]
    list_filter = ["tenant"]
    search_fields = ["nombre", "codigo_rega", "socio__nombre_razon_social"]
    raw_id_fields = ["socio", "tenant"]
