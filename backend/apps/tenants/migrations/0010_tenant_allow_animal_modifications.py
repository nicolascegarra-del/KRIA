from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0009_tenant_importaciones_auditorias_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="allow_animal_modifications",
            field=models.BooleanField(
                default=True,
                help_text="Si está desactivado, ni socios ni gestores pueden modificar campos principales de animales ya aprobados.",
            ),
        ),
    ]
