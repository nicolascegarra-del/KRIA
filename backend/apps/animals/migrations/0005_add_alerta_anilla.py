from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("animals", "0004_add_ganaderia_incubacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="animal",
            name="alerta_anilla",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                help_text="'' sin alerta, 'FUERA_RANGO' fuera del rango, 'DIAMETRO' diámetro incorrecto.",
            ),
        ),
    ]
