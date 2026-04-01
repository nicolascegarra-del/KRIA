from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0012_user_notif_asociacion_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="notif_propuesta_mejora",
            field=models.BooleanField(
                default=False,
                help_text="Recibir email cuando un socio o gestor envíe una propuesta de mejora",
            ),
        ),
    ]
