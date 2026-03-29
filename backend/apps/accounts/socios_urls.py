from django.urls import path
from .views import (
    SocioDarBajaView, SocioDetailView, SocioListCreateView, SocioMeView, SocioReactivarView,
    SocioSolicitarCambioView, SolicitudesCambioListView, SolicitudCambioResolverView,
)
from apps.imports.views import SocioImportView

urlpatterns = [
    path("", SocioListCreateView.as_view(), name="socios-list"),
    path("me/", SocioMeView.as_view(), name="socios-me"),
    path("me/solicitar-cambio/", SocioSolicitarCambioView.as_view(), name="socios-solicitar-cambio"),
    path("solicitudes-cambio/", SolicitudesCambioListView.as_view(), name="socios-solicitudes-cambio"),
    path("solicitudes-cambio/<uuid:pk>/resolver/", SolicitudCambioResolverView.as_view(), name="socios-solicitud-cambio-resolver"),
    path("<uuid:pk>/", SocioDetailView.as_view(), name="socios-detail"),
    path("<uuid:pk>/dar-baja/", SocioDarBajaView.as_view(), name="socios-dar-baja"),
    path("<uuid:pk>/reactivar/", SocioReactivarView.as_view(), name="socios-reactivar"),
    path("import/", SocioImportView.as_view(), name="socios-import"),
]
