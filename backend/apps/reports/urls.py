from django.urls import path
from .views import (
    AuditoriaReportView,
    CatalogoReproductoresView,
    GenealogyCertView,
    IndividualReportView,
    InventoryReportView,
    LibroGenealogicView,
    ReportJobDownloadView,
    ReportJobStatusView,
)

urlpatterns = [
    path("inventory/", InventoryReportView.as_view(), name="report-inventory"),
    path("individual/<uuid:animal_id>/", IndividualReportView.as_view(), name="report-individual"),
    path("genealogical-certificate/<uuid:animal_id>/", GenealogyCertView.as_view(), name="report-genealogy-cert"),
    path("libro-genealogico/", LibroGenealogicView.as_view(), name="report-libro"),
    path("catalogo-reproductores/", CatalogoReproductoresView.as_view(), name="report-catalogo"),
    path("auditoria/<uuid:auditoria_id>/", AuditoriaReportView.as_view(), name="report-auditoria"),
    path("job/<uuid:job_id>/", ReportJobStatusView.as_view(), name="report-job-status"),
    path("job/<uuid:job_id>/download/", ReportJobDownloadView.as_view(), name="report-job-download"),
]
