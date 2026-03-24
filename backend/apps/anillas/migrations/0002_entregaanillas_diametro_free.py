from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("anillas", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="entregaanillas",
            name="diametro",
            field=models.CharField(
                max_length=10,
                help_text="Diámetro de la anilla en mm (configurable por asociación).",
            ),
        ),
    ]
