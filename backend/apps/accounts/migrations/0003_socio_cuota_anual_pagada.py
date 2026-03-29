from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_email_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="socio",
            name="cuota_anual_pagada",
            field=models.PositiveIntegerField(blank=True, help_text="Año hasta el cual el socio tiene pagada la cuota anual", null=True),
        ),
    ]
