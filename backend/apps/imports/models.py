import uuid
from django.db import models
from core.managers import TenantManager
from core.models import UUIDModel


class ImportJob(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        DONE = "DONE", "Done"
        FAILED = "FAILED", "Failed"

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="import_jobs", db_index=True
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="import_jobs"
    )
    file_key = models.CharField(max_length=500)  # MinIO object key
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    result_summary = models.JSONField(default=dict, blank=True)
    error_log = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "imports_importjob"
        verbose_name = "Import Job"
        verbose_name_plural = "Import Jobs"

    def __str__(self):
        return f"ImportJob {self.id} [{self.status}]"
