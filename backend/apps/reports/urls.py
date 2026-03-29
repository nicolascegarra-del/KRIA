from django.urls import path
from .views import (
    CatalogoReproductoresView,
    GenealogyCertView,
    IndividualReportView,
    InventoryReportView,
    LibroGenealogicView,
    ReportJobStatusView,
)

urlpatterns = [
    path("inventory/", InventoryReportView.as_view(), name="report-inventory"),
    path("individual/<uuid:animal_id>/", IndividualReportView.as_view(), name="report-individual"),
    path("genealogical-certificate/<uuid:animal_id>/", GenealogyCertView.as_view(), name="report-genealogy-cert"),
    path("libro-genealogico/", LibroGenealogicView.as_view(), name="report-libro"),
    path("catalogo-reproductores/", CatalogoReproductoresView.as_view(), name="report-catalogo"),
    path("job/<uuid:job_id>/", ReportJobStatusView.as_view(), name="report-job-status"),
]
