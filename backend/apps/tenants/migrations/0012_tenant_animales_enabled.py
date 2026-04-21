from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0011_tenant_tablas_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='animales_enabled',
            field=models.BooleanField(default=False, help_text='Habilita el módulo de Animales (censo genealógico).'),
        ),
    ]
