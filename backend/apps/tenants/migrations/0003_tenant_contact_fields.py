from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0002_tenant_max_socios"),
    ]

    operations = [
        migrations.AddField(
            model_name="tenant",
            name="nombre_completo",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="tenant",
            name="cif",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="tenant",
            name="domicilio",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="tenant",
            name="email_asociacion",
            field=models.EmailField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono1",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono1_nombre",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono1_cargo",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono2",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono2_nombre",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="tenant",
            name="telefono2_cargo",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
    ]
