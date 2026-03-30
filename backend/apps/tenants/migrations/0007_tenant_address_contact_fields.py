from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0006_platformsettings_inactivity_timeout"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="cod_postal",
            field=models.CharField(blank=True, default="", max_length=10),
        ),
        migrations.AddField(
            model_name="tenant",
            name="municipio",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="tenant",
            name="provincia",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono1_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono2_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
    ]
