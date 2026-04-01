from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0008_update_default_colors"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="importaciones_enabled",
            field=models.BooleanField(default=True, help_text="Habilita el módulo de importaciones masivas."),
        ),
        migrations.AddField(
            model_name="tenant",
            name="auditorias_enabled",
            field=models.BooleanField(default=True, help_text="Habilita el módulo de auditorías."),
        ),
    ]
