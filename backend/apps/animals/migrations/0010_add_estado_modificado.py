from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0009_rename_estado_añadido_to_registrado"),
    ]

    operations = [
        migrations.AlterField(
            model_name="animal",
            name="estado",
            field=models.CharField(
                choices=[
                    ("REGISTRADO", "Registrado"),
                    ("MODIFICADO", "Modificado"),
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
