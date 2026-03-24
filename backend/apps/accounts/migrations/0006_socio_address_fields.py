from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_socio_conditional_unique"),
    ]

    operations = [
        # Make user nullable (socios can exist without a login account)
        migrations.AlterField(
            model_name="socio",
            name="user",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="socio",
                to="accounts.user",
            ),
        ),
        # Rename direccion → domicilio
        migrations.RenameField(
            model_name="socio",
            old_name="direccion",
            new_name="domicilio",
        ),
        # New address sub-fields
        migrations.AddField(
            model_name="socio",
            name="municipio",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="socio",
            name="codigo_postal",
            field=models.CharField(blank=True, default="", max_length=10),
        ),
        migrations.AddField(
            model_name="socio",
            name="provincia",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        # Bank account
        migrations.AddField(
            model_name="socio",
            name="numero_cuenta",
            field=models.CharField(
                blank=True,
                default="",
                max_length=34,
                help_text="IBAN / número de cuenta bancaria",
            ),
        ),
    ]
