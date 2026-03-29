from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_solicitudcambiodatos"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notif_nueva_asociacion",
            field=models.BooleanField(
                default=False,
                help_text="Recibir email cuando se cree una nueva asociación en la plataforma",
            ),
        ),
    ]
