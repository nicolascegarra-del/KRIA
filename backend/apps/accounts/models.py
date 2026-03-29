"""
Custom User + Socio models for Kria.

User: email-based auth, tenant-scoped, dual role (socio / gestión).
Socio: profile attached to User, carries ARCA/Ministerio fields.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from core.managers import TenantManager
from core.models import UUIDModel


class UserManager(BaseUserManager):
    def create_user(self, email, tenant, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, tenant=tenant, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        """Creates a platform-level superadmin (no tenant scoping)."""
        from apps.tenants.models import Tenant

        # Get or create a system tenant for superadmins
        tenant, _ = Tenant.objects.get_or_create(
            slug="system",
            defaults={"name": "System", "is_active": True, "max_socios": 0},
        )
        extra.setdefault("is_gestion", True)
        extra.setdefault("is_superadmin", True)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, tenant=tenant, password=password, **extra)


class User(AbstractBaseUser, PermissionsMixin, UUIDModel):
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="users",
        db_index=True,
    )
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_gestion = models.BooleanField(default=False)
    is_superadmin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    # Password reset token (simple approach — one active token per user)
    reset_token = models.UUIDField(null=True, blank=True)
    reset_token_created = models.DateTimeField(null=True, blank=True)

    # Preferencias de notificaciones por email (solo relevante para superadmins)
    notif_nueva_asociacion = models.BooleanField(
        default=False,
        help_text="Recibir email cuando se cree una nueva asociación en la plataforma",
    )
    notif_asociacion_suspendida = models.BooleanField(
        default=False,
        help_text="Recibir email cuando se suspenda una asociación",
    )
    notif_asociacion_activada = models.BooleanField(
        default=False,
        help_text="Recibir email cuando se reactive una asociación",
    )
    notif_asociacion_eliminada = models.BooleanField(
        default=False,
        help_text="Recibir email cuando se elimine una asociación",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "accounts_user"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.email} ({self.tenant.slug})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email


class Socio(UUIDModel):
    class Estado(models.TextChoices):
        ALTA = "ALTA", "Alta"
        BAJA = "BAJA", "Baja"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="socios",
        db_index=True,
    )
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="socio",
        null=True,
        blank=True,
    )
    nombre_razon_social = models.CharField(max_length=300)
    dni_nif = models.CharField(max_length=20)
    telefono = models.CharField(max_length=20, blank=True, default="")
    domicilio = models.TextField(blank=True, default="")
    municipio = models.CharField(max_length=100, blank=True, default="")
    codigo_postal = models.CharField(max_length=10, blank=True, default="")
    provincia = models.CharField(max_length=100, blank=True, default="")
    numero_cuenta = models.CharField(max_length=34, blank=True, default="", help_text="IBAN / número de cuenta bancaria")
    numero_socio = models.CharField(max_length=50, blank=True, default="")
    codigo_rega = models.CharField(max_length=50, blank=True, default="")
    fecha_alta = models.DateField(null=True, blank=True, help_text="Fecha de alta del socio en la asociación")
    cuota_anual_pagada = models.PositiveIntegerField(null=True, blank=True, help_text="Año hasta el cual el socio tiene pagada la cuota anual")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ALTA)
    razon_baja = models.TextField(blank=True, default="")
    fecha_baja = models.DateField(null=True, blank=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "accounts_socio"
        # Unicidad solo cuando el campo no está vacío (permite múltiples socios sin DNI/nº)
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "dni_nif"],
                condition=models.Q(dni_nif__gt=""),
                name="unique_socio_tenant_dni_nif",
            ),
            models.UniqueConstraint(
                fields=["tenant", "numero_socio"],
                condition=models.Q(numero_socio__gt=""),
                name="unique_socio_tenant_numero_socio",
            ),
        ]
        verbose_name = "Socio"
        verbose_name_plural = "Socios"

    def __str__(self):
        return f"{self.nombre_razon_social} [{self.numero_socio}]"


class SolicitudCambioDatos(UUIDModel):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADO = "APROBADO", "Aprobado"
        DENEGADO = "DENEGADO", "Denegado"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="solicitudes_cambio",
    )
    socio = models.ForeignKey(
        Socio,
        on_delete=models.CASCADE,
        related_name="solicitudes_cambio",
    )
    datos_propuestos = models.JSONField()
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_solicitudcambiodatos"
        ordering = ["-created_at"]


class Notificacion(UUIDModel):
    class Tipo(models.TextChoices):
        ANIMAL_APROBADO = "ANIMAL_APROBADO", "Animal aprobado"
        ANIMAL_RECHAZADO = "ANIMAL_RECHAZADO", "Animal rechazado"
        REALTA_APROBADA = "REALTA_APROBADA", "Re-alta aprobada"
        REALTA_DENEGADA = "REALTA_DENEGADA", "Re-alta denegada"
        REPRODUCTOR_APROBADO = "REPRODUCTOR_APROBADO", "Reproductor aprobado"
        REPRODUCTOR_DENEGADO = "REPRODUCTOR_DENEGADO", "Reproductor denegado"
        CAMBIO_DATOS_APROBADO = "CAMBIO_DATOS_APROBADO", "Cambio de datos aprobado"
        CAMBIO_DATOS_DENEGADO = "CAMBIO_DATOS_DENEGADO", "Cambio de datos denegado"
        CUOTA_PENDIENTE = "CUOTA_PENDIENTE", "Cuota anual pendiente"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="notificaciones",
    )
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notificaciones",
    )
    tipo = models.CharField(max_length=50, choices=Tipo.choices)
    animal_id_str = models.CharField(max_length=40, blank=True)
    animal_anilla = models.CharField(max_length=100, blank=True)
    mensaje = models.TextField(blank=True)
    leida = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_notificacion"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tipo} — {self.animal_anilla}"


class MailLog(models.Model):
    """Registro de cada intento de envío de email por la plataforma."""
    tipo = models.CharField(max_length=80, default="GENERAL", db_index=True)
    destinatarios = models.TextField()
    asunto = models.CharField(max_length=500)
    cuerpo = models.TextField(blank=True)
    success = models.BooleanField(default=False)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_mail_log"
        ordering = ["-sent_at"]
        verbose_name = "Log de Mail"
        verbose_name_plural = "Logs de Mail"

    def __str__(self):
        return f"[{self.tipo}] {self.asunto} → {self.destinatarios[:60]} ({'OK' if self.success else 'ERROR'})"


class UserAccessLog(models.Model):
    """Records every successful login across all tenants and roles."""
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="access_logs",
    )
    tenant_name = models.CharField(max_length=200, blank=True, default="")
    user_email = models.CharField(max_length=254, blank=True, default="")
    user_role = models.CharField(
        max_length=20, blank=True, default="",
        help_text="superadmin | gestion | socio",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_access_log"
        ordering = ["-timestamp"]
        verbose_name = "Log de Acceso"
        verbose_name_plural = "Logs de Acceso"

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} — {self.user_email} ({self.user_role})"
