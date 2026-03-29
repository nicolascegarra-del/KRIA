import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0007_alter_animal_alerta_anilla_alter_animal_estado_and_more"),
        ("accounts", "0006_socio_address_fields"),
        ("lotes", "0001_initial"),
        ("tenants", "0005_alter_platformsettings_id_alter_tenant_anilla_sizes_and_more"),
    ]

    operations = [
        # 1. Migrate OTRA → SIN_DEFINIR
        migrations.RunSQL(
            sql="UPDATE animals_animal SET variedad = 'SIN_DEFINIR' WHERE variedad = 'OTRA'",
            reverse_sql="UPDATE animals_animal SET variedad = 'OTRA' WHERE variedad = 'SIN_DEFINIR'",
        ),

        # 2. Add madre_lote_externo free-text field
        migrations.AddField(
            model_name="animal",
            name="madre_lote_externo",
            field=models.CharField(
                blank=True,
                default="",
                max_length=200,
                help_text="Descripción libre del lote de cría externo de la madre (otra ganadería)",
            ),
        ),

        # 3. GanaderiaNacimientoMap: maps free-text ganadería → real Socio
        migrations.CreateModel(
            name="GanaderiaNacimientoMap",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ganaderia_maps",
                        to="tenants.tenant",
                    ),
                ),
                ("ganaderia_nombre", models.CharField(max_length=200, help_text="Nombre tal como lo escribió el socio")),
                (
                    "socio_real",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ganaderia_maps",
                        to="accounts.socio",
                        help_text="Socio/ganadería real a la que se redirige",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "animals_ganaderia_map",
                "unique_together": {("tenant", "ganaderia_nombre")},
            },
        ),

        # 4. LoteExternoMap: maps free-text lote description → real Lote
        migrations.CreateModel(
            name="LoteExternoMap",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lote_externo_maps",
                        to="tenants.tenant",
                    ),
                ),
                ("descripcion", models.CharField(max_length=200, help_text="Descripción tal como la escribió el socio")),
                (
                    "lote_real",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="lote_externo_maps",
                        to="lotes.lote",
                        help_text="Lote real al que se redirige",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "animals_lote_externo_map",
                "unique_together": {("tenant", "descripcion")},
            },
        ),
    ]
