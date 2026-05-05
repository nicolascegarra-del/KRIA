import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('animals', '0013_animal_historico_ganaderias'),
        ('accounts', '0017_pad_numero_socio_3digits'),
    ]

    operations = [
        migrations.AddField(
            model_name='animal',
            name='cesion_propuesta',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
        migrations.AddField(
            model_name='animal',
            name='cesion_socio_destino',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cesiones_destino',
                to='accounts.socio',
            ),
        ),
        migrations.AddField(
            model_name='animal',
            name='cesion_estado_previo',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AlterField(
            model_name='animal',
            name='estado',
            field=models.CharField(
                choices=[
                    ('REGISTRADO', 'Registrado'),
                    ('MODIFICADO', 'Modificado'),
                    ('APROBADO', 'Aprobado'),
                    ('EVALUADO', 'Evaluado'),
                    ('RECHAZADO', 'Rechazado'),
                    ('SOCIO_EN_BAJA', 'Socio en baja'),
                    ('BAJA', 'Baja'),
                    ('PENDIENTE_CESION', 'Pendiente de cesión'),
                ],
                default='REGISTRADO',
                max_length=20,
            ),
        ),
    ]
