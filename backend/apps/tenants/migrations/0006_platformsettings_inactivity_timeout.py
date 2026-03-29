from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0005_alter_platformsettings_id_alter_tenant_anilla_sizes_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformsettings",
            name="inactivity_timeout_minutes",
            field=models.PositiveIntegerField(
                default=30,
                help_text="Minutos de inactividad antes de cerrar sesión automáticamente. 0 = desactivado.",
            ),
        ),
    ]
