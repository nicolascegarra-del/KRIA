from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("evaluaciones", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="evaluacion",
            name="picos_cresta",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="evaluacion",
            name="color_orejilla",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="evaluacion",
            name="color_general",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="evaluacion",
            name="peso_evaluacion",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="evaluacion",
            name="variedad_confirmada",
            field=models.CharField(
                blank=True,
                choices=[("SALMON", "Salmón"), ("PLATA", "Plata"), ("OTRA", "Otra")],
                max_length=20,
                null=True,
            ),
        ),
    ]
