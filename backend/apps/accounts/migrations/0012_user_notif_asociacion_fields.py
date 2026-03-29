from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0011_maillog"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notif_asociacion_suspendida",
            field=models.BooleanField(default=False, help_text="Recibir email cuando se suspenda una asociación"),
        ),
        migrations.AddField(
            model_name="user",
            name="notif_asociacion_activada",
            field=models.BooleanField(default=False, help_text="Recibir email cuando se reactive una asociación"),
        ),
        migrations.AddField(
            model_name="user",
            name="notif_asociacion_eliminada",
            field=models.BooleanField(default=False, help_text="Recibir email cuando se elimine una asociación"),
        ),
    ]
