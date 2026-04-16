from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0010_tenant_allow_animal_modifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="tablas_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Habilita el módulo de Tablas de Control.",
            ),
        ),
    ]
