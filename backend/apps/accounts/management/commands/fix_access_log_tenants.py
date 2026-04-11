"""
Management command: fix_access_log_tenants

Retroactively assigns the correct tenant to UserAccessLog entries that were
logged with tenant=None due to the login endpoint being tenant-exempt and the
middleware not being able to resolve the tenant without a JWT or subdomain.

Safe to run multiple times (idempotent).
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Fix UserAccessLog entries that have tenant=None by looking up the user's tenant."

    def handle(self, *args, **options):
        from apps.accounts.models import User, UserAccessLog

        # Only fix non-superadmin logs with no tenant
        orphan_logs = UserAccessLog.objects.filter(tenant=None).exclude(user_role="superadmin")
        total = orphan_logs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS("No hay logs sin tenant que corregir."))
            return

        self.stdout.write(f"Corrigiendo {total} logs sin tenant...")

        # Build email → user map once (email is globally unique)
        emails = orphan_logs.values_list("user_email", flat=True).distinct()
        user_map = {
            u.email: u
            for u in User.objects.filter(email__in=emails).select_related("tenant")
            if u.tenant
        }

        updated = 0
        for log in orphan_logs.iterator(chunk_size=500):
            user = user_map.get(log.user_email)
            if user and user.tenant:
                log.tenant = user.tenant
                log.tenant_name = user.tenant.name
                log.save(update_fields=["tenant", "tenant_name"])
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Corregidos {updated} de {total} logs. "
                               f"{total - updated} no pudieron resolverse (usuarios eliminados o superadmins).")
        )
