"""
Migration: rename estado value AÑADIDO → REGISTRADO
- Updates field choices
- Data migration: converts existing rows in DB
"""
from django.db import migrations, models


def rename_estado_forward(apps, schema_editor):
    Animal = apps.get_model("animals", "Animal")
    Animal.objects.filter(estado="AÑADIDO").update(estado="REGISTRADO")


def rename_estado_backward(apps, schema_editor):
    Animal = apps.get_model("animals", "Animal")
    Animal.objects.filter(estado="REGISTRADO").update(estado="AÑADIDO")


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0008_animal_variedad_lote_externo_maps"),
    ]

    operations = [
        # 1. Data migration first (while old choices still valid)
        migrations.RunPython(rename_estado_forward, rename_estado_backward),
        # 2. Update field choices
        migrations.AlterField(
            model_name="animal",
            name="estado",
            field=models.CharField(
                choices=[
                    ("REGISTRADO", "Registrado"),
                    ("APROBADO", "Aprobado"),
                    ("EVALUADO", "Evaluado"),
                    ("RECHAZADO", "Rechazado"),
                    ("SOCIO_EN_BAJA", "Socio en baja"),
                    ("BAJA", "Baja"),
                ],
                default="REGISTRADO",
                max_length=20,
            ),
        ),
    ]
