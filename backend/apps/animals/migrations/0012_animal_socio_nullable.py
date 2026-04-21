from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('animals', '0011_alter_ganaderianacimientomap_options_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='animal',
            name='socio',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='animals',
                to='accounts.socio',
            ),
        ),
    ]
