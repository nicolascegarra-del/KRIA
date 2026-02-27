from django.urls import path
from .views import ImportJobStatusView

urlpatterns = [
    path("job/<uuid:job_id>/", ImportJobStatusView.as_view(), name="import-job-status"),
]
