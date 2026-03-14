from django.urls import path
from .views import (
    DocumentoDetailView,
    DocumentoDownloadView,
    DocumentoGeneralListView,
    DocumentoGeneralUploadView,
    DocumentoSocioListView,
    DocumentoSocioUploadView,
)

urlpatterns = [
    path("general/", DocumentoGeneralListView.as_view(), name="documentos-general-list"),
    path("general/upload/", DocumentoGeneralUploadView.as_view(), name="documentos-general-upload"),
    path("socios/<uuid:socio_id>/", DocumentoSocioListView.as_view(), name="documentos-socio-list"),
    path("socios/<uuid:socio_id>/upload/", DocumentoSocioUploadView.as_view(), name="documentos-socio-upload"),
    path("<uuid:pk>/", DocumentoDetailView.as_view(), name="documentos-detail"),
    path("<uuid:pk>/download/", DocumentoDownloadView.as_view(), name="documentos-download"),
]
