from rest_framework import serializers
from .models import BackupJob


class BackupJobSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = BackupJob
        fields = [
            "id",
            "tenant_id_snapshot",
            "tenant_slug_snapshot",
            "tenant_name_snapshot",
            "job_type",
            "status",
            "created_by_email",
            "created_at",
            "completed_at",
            "file_key",
            "file_size_bytes",
            "error_message",
            "result_summary",
        ]
