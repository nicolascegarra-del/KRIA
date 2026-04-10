import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BackupJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tenant_id_snapshot", models.UUIDField()),
                ("tenant_slug_snapshot", models.CharField(max_length=100)),
                ("tenant_name_snapshot", models.CharField(max_length=200)),
                ("job_type", models.CharField(choices=[("EXPORT", "Exportación"), ("IMPORT", "Importación")], max_length=10)),
                ("status", models.CharField(choices=[("PENDING", "Pendiente"), ("RUNNING", "En proceso"), ("COMPLETED", "Completado"), ("FAILED", "Fallido")], default="PENDING", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("file_key", models.CharField(blank=True, default="", max_length=500)),
                ("file_size_bytes", models.BigIntegerField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True, default="")),
                ("result_summary", models.JSONField(blank=True, default=dict)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="backup_jobs",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "Backup Job",
                "verbose_name_plural": "Backup Jobs",
                "db_table": "backups_backupjob",
                "ordering": ["-created_at"],
            },
        ),
    ]
