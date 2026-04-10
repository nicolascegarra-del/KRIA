from django.urls import path
from .views import (
    BackupExportView,
    BackupImportView,
    BackupJobListView,
    BackupJobDetailView,
    BackupJobDownloadView,
    BackupJobClearView,
)

urlpatterns = [
    path("export/", BackupExportView.as_view(), name="backup-export"),
    path("import/", BackupImportView.as_view(), name="backup-import"),
    path("jobs/", BackupJobListView.as_view(), name="backup-jobs-list"),
    path("jobs/clear/", BackupJobClearView.as_view(), name="backup-jobs-clear"),
    path("jobs/<uuid:pk>/", BackupJobDetailView.as_view(), name="backup-job-detail"),
    path("jobs/<uuid:pk>/download/", BackupJobDownloadView.as_view(), name="backup-job-download"),
]
