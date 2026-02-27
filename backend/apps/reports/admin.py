from django.contrib import admin
from .models import ReportJob


@admin.register(ReportJob)
class ReportJobAdmin(admin.ModelAdmin):
    list_display = ["report_type", "status", "tenant", "created_by", "created_at"]
    list_filter = ["tenant", "status", "report_type"]
    readonly_fields = ["params", "file_key", "error_log"]
