from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0010_user_notif_nueva_asociacion"),
    ]

    operations = [
        migrations.CreateModel(
            name="MailLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(db_index=True, default="GENERAL", max_length=80)),
                ("destinatarios", models.TextField()),
                ("asunto", models.CharField(max_length=500)),
                ("cuerpo", models.TextField(blank=True)),
                ("success", models.BooleanField(default=False)),
                ("error", models.TextField(blank=True)),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Log de Mail",
                "verbose_name_plural": "Logs de Mail",
                "db_table": "accounts_mail_log",
                "ordering": ["-sent_at"],
            },
        ),
    ]
