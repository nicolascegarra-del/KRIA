import uuid
from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
        ("accounts", "0001_initial"),
        ("animals", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CriterioEvaluacion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("nombre", models.CharField(max_length=150)),
                ("descripcion", models.TextField(blank=True, default="")),
                ("multiplicador", models.DecimalField(decimal_places=2, default=Decimal("1.00"), max_digits=5)),
                ("is_active", models.BooleanField(default=True)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("tenant", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="criterios_evaluacion", to="tenants.tenant")),
            ],
            options={"db_table": "audits_criterio_evaluacion", "ordering": ["orden", "nombre"], "verbose_name": "Criterio de Evaluación"},
        ),
        migrations.CreateModel(
            name="PreguntaInstalacion",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("texto", models.CharField(max_length=400)),
                ("tipo", models.CharField(choices=[("SINO", "Sí / No"), ("TEXTO", "Texto libre"), ("PUNTUACION", "Puntuación (0–10)")], default="SINO", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                ("tenant", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="preguntas_instalacion", to="tenants.tenant")),
            ],
            options={"db_table": "audits_pregunta_instalacion", "ordering": ["orden"], "verbose_name": "Pregunta de Instalación"},
        ),
        migrations.CreateModel(
            name="AuditoriaSession",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("fecha_planificada", models.DateField()),
                ("fecha_realizacion", models.DateField(blank=True, null=True)),
                ("estado", models.CharField(choices=[("PLANIFICADA", "Planificada"), ("EN_CURSO", "En curso"), ("COMPLETADA", "Completada"), ("CANCELADA", "Cancelada")], default="PLANIFICADA", max_length=20)),
                ("auditores", models.TextField(blank=True, default="")),
                ("notas_generales", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tenant", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="auditorias", to="tenants.tenant")),
                ("socio", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="auditorias", to="accounts.socio")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="auditorias_creadas", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "audits_auditoria_session", "ordering": ["-fecha_planificada"], "verbose_name": "Auditoría"},
        ),
        migrations.CreateModel(
            name="AuditoriaAnimal",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("numero_anilla_manual", models.CharField(blank=True, default="", max_length=50)),
                ("puntuaciones", models.JSONField(default=dict)),
                ("puntuacion_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=6)),
                ("puntuacion_maxima", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=6)),
                ("notas", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("auditoria", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="animales_evaluados", to="audits.auditoriasession")),
                ("animal", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="auditorias_evaluacion", to="animals.animal")),
            ],
            options={"db_table": "audits_auditoria_animal", "verbose_name": "Animal Auditado", "unique_together": {("auditoria", "animal")}},
        ),
        migrations.CreateModel(
            name="AuditoriaRespuesta",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("respuesta", models.CharField(blank=True, default="", max_length=1000)),
                ("auditoria", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="respuestas_instalacion", to="audits.auditoriasession")),
                ("pregunta", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="respuestas", to="audits.preguntainstalacion")),
            ],
            options={"db_table": "audits_auditoria_respuesta", "verbose_name": "Respuesta de Instalación", "unique_together": {("auditoria", "pregunta")}},
        ),
    ]
