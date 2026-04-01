from django.urls import path
from .views import (
    AnimalImportConfirmView,
    AnimalImportTemplateView,
    AnimalImportValidateView,
    ImportConfirmView,
    ImportJobStatusView,
    ImportTemplateView,
    ImportValidateView,
    SocioImportView,
)

urlpatterns = [
    path("", SocioImportView.as_view(), name="import-socios"),
    path("template/", ImportTemplateView.as_view(), name="import-template"),
    path("validate/", ImportValidateView.as_view(), name="import-validate"),
    path("confirm/", ImportConfirmView.as_view(), name="import-confirm"),
    path("job/<uuid:job_id>/", ImportJobStatusView.as_view(), name="import-job-status"),
    # Animal import
    path("animales/template/", AnimalImportTemplateView.as_view(), name="import-animales-template"),
    path("animales/validate/", AnimalImportValidateView.as_view(), name="import-animales-validate"),
    path("animales/confirm/", AnimalImportConfirmView.as_view(), name="import-animales-confirm"),
]
