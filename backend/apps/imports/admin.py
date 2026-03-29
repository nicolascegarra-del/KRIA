from django.contrib import admin
from .models import ImportJob


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ["id", "tenant", "status", "created_at", "finished_at"]
    list_filter = ["tenant", "status"]
    readonly_fields = ["result_summary", "error_log"]
