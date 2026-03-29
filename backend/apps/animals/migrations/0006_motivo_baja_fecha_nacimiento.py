"""
Migration: replace anio_nacimiento (int) with fecha_nacimiento (date),
add MotivoBaja model, add fecha_baja/motivo_baja to Animal.
"""
import datetime
import django.db.models.deletion
import uuid
from django.db import migrations, models


def populate_fecha_nacimiento(apps, schema_editor):
    """Set fecha_nacimiento = Jan 1 of anio_nacimiento for existing animals."""
    Animal = apps.get_model("animals", "Animal")
    for a in Animal.objects.filter(fecha_nacimiento__isnull=True):
        a.fecha_nacimiento = datetime.date(a.anio_nacimiento, 1, 1)
        a.save(update_fields=["fecha_nacimiento"])


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0005_add_alerta_anilla"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        # 1. Create MotivoBaja table
        migrations.CreateModel(
            name="MotivoBaja",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ("nombre", models.CharField(max_length=150)),
                ("is_active", models.BooleanField(default=True)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="motivos_baja",
                        to="tenants.tenant",
                        db_index=True,
                    ),
                ),
            ],
            options={
                "db_table": "animals_motivobaja",
                "ordering": ["orden", "nombre"],
                "verbose_name": "Motivo de Baja",
                "verbose_name_plural": "Motivos de Baja",
            },
        ),

        # 2. Add fecha_nacimiento nullable
        migrations.AddField(
            model_name="animal",
            name="fecha_nacimiento",
            field=models.DateField(null=True, blank=True),
        ),

        # 3. Populate from existing anio_nacimiento
        migrations.RunPython(populate_fecha_nacimiento, migrations.RunPython.noop),

        # 4. Make fecha_nacimiento non-nullable
        migrations.AlterField(
            model_name="animal",
            name="fecha_nacimiento",
            field=models.DateField(),
        ),

        # 5. Remove old unique_together (tenant, numero_anilla, anio_nacimiento)
        migrations.AlterUniqueTogether(
            name="animal",
            unique_together=set(),
        ),

        # 6. Remove anio_nacimiento
        migrations.RemoveField(
            model_name="animal",
            name="anio_nacimiento",
        ),

        # 7. Set new unique_together with fecha_nacimiento
        migrations.AlterUniqueTogether(
            name="animal",
            unique_together={("tenant", "numero_anilla", "fecha_nacimiento")},
        ),

        # 8. Add fecha_baja
        migrations.AddField(
            model_name="animal",
            name="fecha_baja",
            field=models.DateField(null=True, blank=True),
        ),

        # 9. Add motivo_baja FK
        migrations.AddField(
            model_name="animal",
            name="motivo_baja",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="animales",
                to="animals.motivobaja",
            ),
        ),
    ]
