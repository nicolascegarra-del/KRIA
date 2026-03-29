from django.db import models
from core.managers import TenantManager
from core.models import UUIDModel


class ReportJob(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        DONE = "DONE", "Done"
        FAILED = "FAILED", "Failed"

    class ReportType(models.TextChoices):
        INVENTORY = "INVENTORY", "Inventario"
        INDIVIDUAL = "INDIVIDUAL", "Ficha Individual"
        GENEALOGY_CERT = "GENEALOGY_CERT", "Certificado Genealógico"
        LIBRO_GENEALOGICO = "LIBRO_GENEALOGICO", "Libro Genealógico (Excel)"
        CATALOGO_REPRODUCTORES = "CATALOGO_REPRODUCTORES", "Catálogo Reproductores (PDF)"

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="report_jobs", db_index=True
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="report_jobs"
    )
    report_type = models.CharField(max_length=40, choices=ReportType.choices)
    params = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    file_key = models.CharField(max_length=500, blank=True, default="")
    error_log = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "reports_reportjob"
        verbose_name = "Report Job"
        verbose_name_plural = "Report Jobs"

    def __str__(self):
        return f"{self.report_type} [{self.status}]"
