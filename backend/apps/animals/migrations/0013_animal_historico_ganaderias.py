from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('animals', '0012_animal_socio_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='animal',
            name='historico_ganaderias',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
