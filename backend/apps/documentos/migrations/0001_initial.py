import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("tenants", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Documento",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tipo", models.CharField(
                    choices=[("GENERAL", "General (Junta)"), ("PARTICULAR", "Particular (Socio)")],
                    max_length=12,
                )),
                ("nombre_archivo", models.CharField(max_length=255)),
                ("file_key", models.CharField(max_length=500)),
                ("content_type", models.CharField(max_length=100)),
                ("tamanio_bytes", models.PositiveIntegerField()),
                ("version", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("tenant", models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="documentos",
                    to="tenants.tenant",
                )),
                ("socio", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="documentos",
                    to="accounts.socio",
                )),
                ("subido_por", models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="documentos_subidos",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "Documento",
                "verbose_name_plural": "Documentos",
                "db_table": "documentos_documento",
                "ordering": ["-created_at"],
            },
        ),
    ]
