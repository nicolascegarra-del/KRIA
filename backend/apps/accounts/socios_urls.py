from django.urls import path
from .views import SocioDarBajaView, SocioDetailView, SocioListCreateView
from apps.imports.views import SocioImportView

urlpatterns = [
    path("", SocioListCreateView.as_view(), name="socios-list"),
    path("<uuid:pk>/", SocioDetailView.as_view(), name="socios-detail"),
    path("<uuid:pk>/dar-baja/", SocioDarBajaView.as_view(), name="socios-dar-baja"),
    path("import/", SocioImportView.as_view(), name="socios-import"),
]
