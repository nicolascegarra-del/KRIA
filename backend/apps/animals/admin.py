from django.contrib import admin
from .models import Animal


@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ["numero_anilla", "anio_nacimiento", "sexo", "variedad", "estado", "socio", "tenant"]
    list_filter = ["tenant", "estado", "variedad", "sexo"]
    search_fields = ["numero_anilla"]
    raw_id_fields = ["socio", "padre", "madre_animal", "madre_lote"]
