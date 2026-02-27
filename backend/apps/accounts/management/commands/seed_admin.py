"""
Management command: seed_admin

Creates (or updates) the first superadmin user AND a demo socio user
with a linked Socio profile, ready to test all app features.

Usage:
  python manage.py seed_admin
  python manage.py seed_admin --email admin@example.com --password secret123
  python manage.py seed_admin --tenant myassoc --tenant-name "Mi Asociación"
"""
from django.core.management.base import BaseCommand

from apps.tenants.models import Tenant
from apps.accounts.models import User, Socio


class Command(BaseCommand):
    help = "Seed initial superadmin + demo socio user and demo tenant"

    def add_arguments(self, parser):
        parser.add_argument("--email", default="admin@agamur.es")
        parser.add_argument("--password", default="agamur2024!")
        parser.add_argument("--tenant", default="demo")
        parser.add_argument("--tenant-name", default="Asociación Demo AGAMUR")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        slug = options["tenant"]
        tenant_name = options["tenant_name"]

        # ── 1. Tenant ──────────────────────────────────────────────────────────
        tenant, t_created = Tenant.objects.update_or_create(
            slug=slug,
            defaults={
                "name": tenant_name,
                "is_active": True,
                "primary_color": "#1565C0",
                "secondary_color": "#FBC02D",
            },
        )
        action = "Created" if t_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} tenant: {tenant.name} (slug={tenant.slug})"
        ))

        # ── 2. Superadmin (gestión) ────────────────────────────────────────────
        admin_user, u_created = User.objects.update_or_create(
            tenant=tenant,
            email=email,
            defaults={
                "is_gestion": True,
                "is_superadmin": True,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "first_name": "Admin",
                "last_name": "AGAMUR",
            },
        )
        admin_user.set_password(password)
        admin_user.save()

        action = "Created" if u_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} superadmin: {email} (tenant={tenant.slug})"
        ))

        # ── 3. Demo socio user + Socio profile ────────────────────────────────
        socio_email = "socio@agamur.es"
        socio_password = "socio2024!"

        socio_user, su_created = User.objects.update_or_create(
            tenant=tenant,
            email=socio_email,
            defaults={
                "is_gestion": False,
                "is_superadmin": False,
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
                "first_name": "Socio",
                "last_name": "Demo",
            },
        )
        socio_user.set_password(socio_password)
        socio_user.save()

        action = "Created" if su_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} socio user: {socio_email}"
        ))

        # Create/update the Socio profile linked to this user
        socio_profile, sp_created = Socio.all_objects.update_or_create(
            tenant=tenant,
            user=socio_user,
            defaults={
                "nombre_razon_social": "Granja Demo S.L.",
                "dni_nif": "12345678A",
                "telefono": "612345678",
                "direccion": "Calle Mayor 1, 28001 Madrid",
                "numero_socio": "0001",
                "codigo_rega": "ES280101000001",
                "estado": Socio.Estado.ALTA,
            },
        )
        action = "Created" if sp_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} socio profile: {socio_profile.nombre_razon_social} "
            f"(nº {socio_profile.numero_socio})"
        ))

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("=" * 55))
        self.stdout.write(self.style.WARNING("  AGAMUR — Usuarios de prueba creados"))
        self.stdout.write(self.style.WARNING("=" * 55))
        self.stdout.write(f"  URL:             http://localhost:5173")
        self.stdout.write(f"  Tenant (código): {slug}")
        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("  👤 GESTIÓN (panel de administración):"))
        self.stdout.write(f"     Email:      {email}")
        self.stdout.write(f"     Contraseña: {password}")
        self.stdout.write(f"     Checkbox:   ✓ Acceder como equipo de Gestión")
        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("  🐔 SOCIO (mis animales / mis granjas):"))
        self.stdout.write(f"     Email:      {socio_email}")
        self.stdout.write(f"     Contraseña: {socio_password}")
        self.stdout.write(f"     Checkbox:   ✗ (NO marcar gestión)")
        self.stdout.write(self.style.WARNING("=" * 55))
