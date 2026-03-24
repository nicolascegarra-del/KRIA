from django.urls import path
from .views import (
    AnimalApproveView,
    AnimalDarBajaView,
    AnimalDetailView,
    AnimalFotoUploadView,
    AnimalGenealogyView,
    AnimalGlobalSearchView,
    AnimalListCreateView,
    AnimalMotivosRechazoView,
    AnimalPesajeView,
    AnimalRejectView,
    AnimalReproductorApproveView,
    AnimalSolicitarRealtaView,
)

urlpatterns = [
    path("", AnimalListCreateView.as_view(), name="animals-list"),
    path("search-global/", AnimalGlobalSearchView.as_view(), name="animals-search-global"),
    path("motivos-rechazo/", AnimalMotivosRechazoView.as_view(), name="animals-motivos-rechazo"),
    path("<uuid:pk>/", AnimalDetailView.as_view(), name="animals-detail"),
    path("<uuid:pk>/approve/", AnimalApproveView.as_view(), name="animals-approve"),
    path("<uuid:pk>/reject/", AnimalRejectView.as_view(), name="animals-reject"),
    path("<uuid:pk>/genealogy/", AnimalGenealogyView.as_view(), name="animals-genealogy"),
    path("<uuid:pk>/foto/", AnimalFotoUploadView.as_view(), name="animals-foto"),
    path("<uuid:pk>/pesaje/", AnimalPesajeView.as_view(), name="animals-pesaje"),
    path("<uuid:pk>/aprobar-reproductor/", AnimalReproductorApproveView.as_view(), name="animals-aprobar-reproductor"),
    path("<uuid:pk>/solicitar-realta/", AnimalSolicitarRealtaView.as_view(), name="animals-solicitar-realta"),
    path("<uuid:pk>/dar-baja/", AnimalDarBajaView.as_view(), name="animals-dar-baja"),
]
