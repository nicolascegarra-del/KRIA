from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reportjob",
            name="report_type",
            field=models.CharField(
                choices=[
                    ("INVENTORY", "Inventario"),
                    ("INDIVIDUAL", "Ficha Individual"),
                    ("GENEALOGY_CERT", "Certificado Genealógico"),
                    ("LIBRO_GENEALOGICO", "Libro Genealógico (Excel)"),
                    ("CATALOGO_REPRODUCTORES", "Catálogo Reproductores (PDF)"),
                    ("AUDITORIA", "Informe de Auditoría (PDF)"),
                ],
                max_length=40,
            ),
        ),
    ]
