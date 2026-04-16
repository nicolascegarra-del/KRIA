import uuid

from django.db import models


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    logo_url = models.URLField(blank=True, default="")
    primary_color = models.CharField(max_length=7, default="#051937")   # hex
    secondary_color = models.CharField(max_length=7, default="#2E6DB4")
    custom_domain = models.CharField(max_length=200, blank=True, default="", db_index=True)
    is_active = models.BooleanField(default=True)
    max_socios = models.PositiveIntegerField(
        default=50,
        help_text="Límite máximo de socios activos. 0 = sin límite.",
    )
    # ── Datos de contacto de la asociación (todos opcionales) ────────────────
    nombre_completo = models.CharField(max_length=300, blank=True, default="")
    cif = models.CharField(max_length=20, blank=True, default="")
    domicilio = models.TextField(blank=True, default="")
    cod_postal = models.CharField(max_length=10, blank=True, default="")
    municipio = models.CharField(max_length=200, blank=True, default="")
    provincia = models.CharField(max_length=100, blank=True, default="")
    email_asociacion = models.EmailField(blank=True, default="")
    telefono1 = models.CharField(max_length=20, blank=True, default="")
    telefono1_nombre = models.CharField(max_length=150, blank=True, default="")
    telefono1_cargo = models.CharField(max_length=150, blank=True, default="")
    telefono1_email = models.EmailField(blank=True, default="")
    telefono2 = models.CharField(max_length=20, blank=True, default="")
    telefono2_nombre = models.CharField(max_length=150, blank=True, default="")
    telefono2_cargo = models.CharField(max_length=150, blank=True, default="")
    telefono2_email = models.EmailField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    # ── Feature flags ────────────────────────────────────────────────────────
    granjas_enabled = models.BooleanField(default=True, help_text="Habilita granjas múltiples para socios.")
    importaciones_enabled = models.BooleanField(default=True, help_text="Habilita el módulo de importaciones masivas.")
    auditorias_enabled = models.BooleanField(default=True, help_text="Habilita el módulo de auditorías.")
    allow_animal_modifications = models.BooleanField(
        default=True,
        help_text="Si está desactivado, ni socios ni gestores pueden modificar campos principales de animales ya aprobados.",
    )
    tablas_enabled = models.BooleanField(default=False, help_text="Habilita el módulo de Tablas de Control.")

    # ── Configuración de anillas ─────────────────────────────────────────────
    anilla_sizes = models.JSONField(
        default=list, blank=True,
        help_text='Tamaños disponibles. Ej: [{"mm":"18","sexo":"H"},{"mm":"20","sexo":"M"}]',
    )

    # ── Email de notificaciones (adónde el superadmin envía notificaciones) ──
    email_notificaciones = models.EmailField(blank=True, default="")

    # ── SMTP de la asociación (para enviar notificaciones a socios) ───────────
    smtp_host = models.CharField(max_length=255, blank=True, default="")
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True, default="")
    smtp_password = models.CharField(max_length=255, blank=True, default="")
    smtp_from_email = models.EmailField(blank=True, default="")
    smtp_from_name = models.CharField(max_length=255, blank=True, default="")
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)

    class Meta:
        db_table = "tenants_tenant"
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"

    def __str__(self):
        return self.name


class PlatformSettings(models.Model):
    """Configuración global de la plataforma (singleton — solo una fila con pk=1)."""
    smtp_host = models.CharField(max_length=255, blank=True, default="")
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_user = models.CharField(max_length=255, blank=True, default="")
    smtp_password = models.CharField(max_length=255, blank=True, default="")
    smtp_from_email = models.EmailField(blank=True, default="")
    smtp_from_name = models.CharField(max_length=255, blank=True, default="KRIA Platform")
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    inactivity_timeout_minutes = models.PositiveIntegerField(
        default=30,
        help_text="Minutos de inactividad antes de cerrar sesión automáticamente. 0 = desactivado.",
    )

    class Meta:
        db_table = "tenants_platformsettings"
        verbose_name = "Configuración de la plataforma"

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Configuración de la plataforma"
