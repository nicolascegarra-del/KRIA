import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_useraccesslog"),
        ("tenants", "0005_alter_platformsettings_id_alter_tenant_anilla_sizes_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notificacion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notificaciones", to="tenants.tenant")),
                ("usuario", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notificaciones", to=settings.AUTH_USER_MODEL)),
                ("tipo", models.CharField(choices=[("ANIMAL_APROBADO", "Animal aprobado"), ("ANIMAL_RECHAZADO", "Animal rechazado")], max_length=50)),
                ("animal_id_str", models.CharField(blank=True, max_length=40)),
                ("animal_anilla", models.CharField(blank=True, max_length=100)),
                ("mensaje", models.TextField(blank=True)),
                ("leida", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "accounts_notificacion",
                "ordering": ["-created_at"],
            },
        ),
    ]
