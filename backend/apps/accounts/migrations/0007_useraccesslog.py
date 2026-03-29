from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_socio_address_fields"),
        ("tenants", "0005_alter_platformsettings_id_alter_tenant_anilla_sizes_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAccessLog",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="access_logs",
                        to="tenants.tenant",
                    ),
                ),
                ("tenant_name", models.CharField(blank=True, default="", max_length=200)),
                ("user_email", models.CharField(blank=True, default="", max_length=254)),
                ("user_role", models.CharField(blank=True, default="", max_length=20)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Log de Acceso",
                "verbose_name_plural": "Logs de Acceso",
                "db_table": "accounts_access_log",
                "ordering": ["-timestamp"],
            },
        ),
    ]
