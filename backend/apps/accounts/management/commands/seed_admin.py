"""
Management command: seed_admin

Creates (or updates) the first superadmin user and a default demo tenant.

Usage:
  python manage.py seed_admin
  python manage.py seed_admin --email admin@example.com --password secret123
  python manage.py seed_admin --tenant myassoc --tenant-name "Mi Asociación"
"""
from django.core.management.base import BaseCommand

from apps.tenants.models import Tenant
from apps.accounts.models import User


class Command(BaseCommand):
    help = "Seed initial superadmin user and demo tenant"

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

        # Create / update tenant
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
        self.stdout.write(self.style.SUCCESS(f"{action} tenant: {tenant.name} (slug={tenant.slug})"))

        # Create / update superadmin
        user, u_created = User.objects.update_or_create(
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
        user.set_password(password)
        user.save()

        action = "Created" if u_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} superadmin: {email} (tenant={tenant.slug})"
        ))
        self.stdout.write(self.style.WARNING(
            f"\nLogin at http://localhost:5173 with:\n  Email: {email}\n  Password: {password}\n  X-Tenant-Slug: {slug}"
        ))
