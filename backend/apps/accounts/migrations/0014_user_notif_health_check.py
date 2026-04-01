from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0013_user_notif_propuesta_mejora"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notif_health_check",
            field=models.BooleanField(
                default=False,
                help_text="Recibir informe de estado del sistema dos veces al día (7:30 y 19:30)",
            ),
        ),
    ]
