from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_socio_fecha_alta"),
    ]

    operations = [
        # Eliminar unique_together antiguo
        migrations.AlterUniqueTogether(
            name="socio",
            unique_together=set(),
        ),
        # Añadir restricciones condicionales: solo aplican cuando el campo no está vacío
        migrations.AddConstraint(
            model_name="socio",
            constraint=models.UniqueConstraint(
                fields=["tenant", "dni_nif"],
                condition=models.Q(dni_nif__gt=""),
                name="unique_socio_tenant_dni_nif",
            ),
        ),
        migrations.AddConstraint(
            model_name="socio",
            constraint=models.UniqueConstraint(
                fields=["tenant", "numero_socio"],
                condition=models.Q(numero_socio__gt=""),
                name="unique_socio_tenant_numero_socio",
            ),
        ),
    ]
