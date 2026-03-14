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
            name="EntregaAnillas",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("anio_campana", models.PositiveSmallIntegerField(
                    help_text="Año de campaña al que corresponde el rango (ej. 2024)."
                )),
                ("rango_inicio", models.CharField(
                    max_length=50,
                    help_text="Primer número de anilla del rango asignado.",
                )),
                ("rango_fin", models.CharField(
                    max_length=50,
                    help_text="Último número de anilla del rango asignado.",
                )),
                ("diametro", models.CharField(
                    max_length=2,
                    choices=[("18", "18 mm (Hembra)"), ("20", "20 mm (Macho)")],
                    help_text="18 mm para hembras, 20 mm para machos.",
                )),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="entregas_anillas_creadas",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("socio", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="entregas_anillas",
                    to="accounts.socio",
                )),
                ("tenant", models.ForeignKey(
                    db_index=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="entregas_anillas",
                    to="tenants.tenant",
                )),
            ],
            options={
                "verbose_name": "Entrega de Anillas",
                "verbose_name_plural": "Entregas de Anillas",
                "db_table": "anillas_entregaanillas",
                "ordering": ["-anio_campana", "socio"],
            },
        ),
    ]
