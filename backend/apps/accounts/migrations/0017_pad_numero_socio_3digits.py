from django.db import migrations


def pad_numero_socio(apps, schema_editor):
    """Rellena numero_socio a 3 dígitos para todos los socios con valor numérico.

    Ejemplos: "01" → "001", "10" → "010", "100" → "100" (sin cambio).
    Incluye socios en alta y en baja.
    """
    schema_editor.execute(
        """
        UPDATE accounts_socio
        SET numero_socio = LPAD(numero_socio, 3, '0')
        WHERE numero_socio ~ '^[0-9]+$'
          AND LENGTH(numero_socio) < 3
        """
    )


def unpad_numero_socio(apps, schema_editor):
    """Deshace el padding eliminando ceros iniciales (quita ceros a la izquierda)."""
    schema_editor.execute(
        """
        UPDATE accounts_socio
        SET numero_socio = LTRIM(numero_socio, '0')
        WHERE numero_socio ~ '^0+[0-9]+$'
        """
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_alter_notificacion_tipo_alter_useraccesslog_id_and_more"),
    ]

    operations = [
        migrations.RunPython(pad_numero_socio, reverse_code=unpad_numero_socio),
    ]
