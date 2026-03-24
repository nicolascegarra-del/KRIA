from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0003_tenant_contact_fields"),
    ]

    operations = [
        # Feature flags
        migrations.AddField(model_name="tenant", name="granjas_enabled", field=models.BooleanField(default=True)),
        # Anilla sizes
        migrations.AddField(model_name="tenant", name="anilla_sizes", field=models.JSONField(blank=True, default=list)),
        # Email notificaciones
        migrations.AddField(model_name="tenant", name="email_notificaciones", field=models.EmailField(blank=True, default="")),
        # SMTP por asociación
        migrations.AddField(model_name="tenant", name="smtp_host", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="tenant", name="smtp_port", field=models.PositiveIntegerField(default=587)),
        migrations.AddField(model_name="tenant", name="smtp_user", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="tenant", name="smtp_password", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="tenant", name="smtp_from_email", field=models.EmailField(blank=True, default="")),
        migrations.AddField(model_name="tenant", name="smtp_from_name", field=models.CharField(blank=True, default="", max_length=255)),
        migrations.AddField(model_name="tenant", name="smtp_use_tls", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="tenant", name="smtp_use_ssl", field=models.BooleanField(default=False)),
        # PlatformSettings singleton
        migrations.CreateModel(
            name="PlatformSettings",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("smtp_host", models.CharField(blank=True, default="", max_length=255)),
                ("smtp_port", models.PositiveIntegerField(default=587)),
                ("smtp_user", models.CharField(blank=True, default="", max_length=255)),
                ("smtp_password", models.CharField(blank=True, default="", max_length=255)),
                ("smtp_from_email", models.EmailField(blank=True, default="")),
                ("smtp_from_name", models.CharField(blank=True, default="KRIA Platform", max_length=255)),
                ("smtp_use_tls", models.BooleanField(default=True)),
                ("smtp_use_ssl", models.BooleanField(default=False)),
            ],
            options={"db_table": "tenants_platformsettings", "verbose_name": "Configuración de la plataforma"},
        ),
    ]
