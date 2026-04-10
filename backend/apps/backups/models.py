from django.db import models
from core.models import UUIDModel


class BackupJob(UUIDModel):
    class JobType(models.TextChoices):
        EXPORT = "EXPORT", "Exportación"
        IMPORT = "IMPORT", "Importación"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendiente"
        RUNNING = "RUNNING", "En proceso"
        COMPLETED = "COMPLETED", "Completado"
        FAILED = "FAILED", "Fallido"

    # Snapshot de datos del tenant (sobrevive a eliminaciones)
    tenant_id_snapshot = models.UUIDField()
    tenant_slug_snapshot = models.CharField(max_length=100)
    tenant_name_snapshot = models.CharField(max_length=200)

    job_type = models.CharField(max_length=10, choices=JobType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="backup_jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Clave MinIO del ZIP (exports) / del ZIP subido (imports durante procesado)
    file_key = models.CharField(max_length=500, blank=True, default="")
    file_size_bytes = models.BigIntegerField(null=True, blank=True)

    error_message = models.TextField(blank=True, default="")
    result_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "backups_backupjob"
        ordering = ["-created_at"]
        verbose_name = "Backup Job"
        verbose_name_plural = "Backup Jobs"

    def __str__(self):
        return f"{self.job_type} {self.tenant_slug_snapshot} [{self.status}]"
