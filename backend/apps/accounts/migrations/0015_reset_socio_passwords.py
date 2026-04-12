"""
Data migration: reset all socio (non-gestion, non-superadmin) user passwords
to unusable and clear any pending reset tokens.

Result: every socio starts from RED state. Gestion must explicitly click
"Enviar acceso" to generate a setup link (AMBER), and the socio then sets
their own password (GREEN).
"""
from django.db import migrations
from django.contrib.auth.hashers import make_password


def reset_socio_passwords(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    unusable = make_password(None)  # "!<random>" — has_usable_password() → False
    (
        User.objects
        .filter(is_gestion=False, is_superadmin=False, socio__isnull=False)
        .update(password=unusable, reset_token=None, reset_token_created=None)
    )


def noop(apps, schema_editor):
    pass  # irreversible — passwords are gone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0014_user_notif_health_check"),
    ]

    operations = [
        migrations.RunPython(reset_socio_passwords, noop),
    ]
