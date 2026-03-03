from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('animals', '0003_add_granja_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='animal',
            name='fecha_incubacion',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='animal',
            name='ganaderia_nacimiento',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='animal',
            name='ganaderia_actual',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
