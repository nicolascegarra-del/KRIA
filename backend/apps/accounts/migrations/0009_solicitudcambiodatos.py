import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_notificacion"),
        ("tenants", "0005_alter_platformsettings_id_alter_tenant_anilla_sizes_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SolicitudCambioDatos",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="solicitudes_cambio", to="tenants.tenant")),
                ("socio", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="solicitudes_cambio", to="accounts.socio")),
                ("datos_propuestos", models.JSONField()),
                ("estado", models.CharField(choices=[("PENDIENTE", "Pendiente"), ("APROBADO", "Aprobado"), ("DENEGADO", "Denegado")], default="PENDIENTE", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "accounts_solicitudcambiodatos",
                "ordering": ["-created_at"],
            },
        ),
    ]
