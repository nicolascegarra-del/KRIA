from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_socio_cuota_anual_pagada"),
    ]

    operations = [
        migrations.AddField(
            model_name="socio",
            name="fecha_alta",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Fecha de alta del socio en la asociación",
            ),
        ),
    ]
