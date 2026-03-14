import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("conflicts", "0001_initial"),
        ("accounts", "0001_initial"),
        ("animals", "0005_add_alerta_anilla"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SolicitudRealta",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("estado", models.CharField(
                    choices=[
                        ("PENDIENTE", "Pendiente"),
                        ("APROBADO", "Aprobado"),
                        ("DENEGADO", "Denegado"),
                    ],
                    default="PENDIENTE",
                    max_length=20,
                )),
                ("notas", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(null=True, blank=True)),
                ("tenant", models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="solicitudes_realta",
                    to="tenants.tenant",
                )),
                ("animal", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="solicitudes_realta",
                    to="animals.animal",
                )),
                ("solicitante", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="solicitudes_realta",
                    to="accounts.socio",
                )),
            ],
            options={
                "verbose_name": "Solicitud de Re-alta",
                "verbose_name_plural": "Solicitudes de Re-alta",
                "db_table": "conflicts_solicitudrealta",
                "ordering": ["-created_at"],
            },
        ),
    ]
