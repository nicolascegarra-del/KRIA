from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='max_socios',
            field=models.PositiveIntegerField(
                default=50,
                help_text='Límite máximo de socios activos. 0 = sin límite.',
            ),
        ),
    ]
