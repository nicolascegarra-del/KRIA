from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Socio, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "tenant", "full_name", "is_gestion", "is_active"]
    list_filter = ["tenant", "is_gestion", "is_superadmin", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering = ["email"]
    fieldsets = (
        (None, {"fields": ("email", "password", "tenant")}),
        ("Personal", {"fields": ("first_name", "last_name")}),
        ("Permissions", {"fields": ("is_gestion", "is_superadmin", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"fields": ("email", "tenant", "password1", "password2")}),
    )


@admin.register(Socio)
class SocioAdmin(admin.ModelAdmin):
    list_display = ["nombre_razon_social", "dni_nif", "numero_socio", "tenant", "estado"]
    list_filter = ["tenant", "estado"]
    search_fields = ["nombre_razon_social", "dni_nif", "numero_socio", "codigo_rega"]
