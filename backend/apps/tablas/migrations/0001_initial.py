import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("tenants", "0011_tenant_tablas_enabled"),
    ]

    operations = [
        migrations.CreateModel(
            name="TablaControl",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("nombre", models.CharField(max_length=200)),
                ("socio_columns", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tablas_control",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "verbose_name": "Tabla de Control",
                "verbose_name_plural": "Tablas de Control",
                "db_table": "tablas_tabla_control",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TablaColumna",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("nombre", models.CharField(max_length=150)),
                ("tipo", models.CharField(
                    choices=[
                        ("CHECKBOX", "Casilla (Sí/No)"),
                        ("TEXT", "Texto libre"),
                        ("DATE", "Fecha"),
                        ("NUMBER", "Número"),
                    ],
                    default="CHECKBOX",
                    max_length=20,
                )),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                (
                    "tabla",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="columnas",
                        to="tablas.tablacontrol",
                    ),
                ),
            ],
            options={
                "verbose_name": "Columna de Control",
                "verbose_name_plural": "Columnas de Control",
                "db_table": "tablas_columna",
                "ordering": ["orden", "nombre"],
            },
        ),
        migrations.CreateModel(
            name="TablaEntrada",
            fields=[
                ("id", models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ("valores", models.JSONField(blank=True, default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tabla",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="entradas",
                        to="tablas.tablacontrol",
                    ),
                ),
                (
                    "socio",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tablas_entradas",
                        to="accounts.socio",
                    ),
                ),
            ],
            options={
                "verbose_name": "Entrada de Tabla",
                "verbose_name_plural": "Entradas de Tabla",
                "db_table": "tablas_entrada",
            },
        ),
        migrations.AddConstraint(
            model_name="tablaentrada",
            constraint=models.UniqueConstraint(
                fields=["tabla", "socio"],
                name="unique_tablaentrada_tabla_socio",
            ),
        ),
    ]
