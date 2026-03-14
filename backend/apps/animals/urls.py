from django.urls import path
from .views import (
    AnimalApproveView,
    AnimalDetailView,
    AnimalFotoUploadView,
    AnimalGenealogyView,
    AnimalGlobalSearchView,
    AnimalListCreateView,
    AnimalPesajeView,
    AnimalRejectView,
    AnimalReproductorApproveView,
)

urlpatterns = [
    path("", AnimalListCreateView.as_view(), name="animals-list"),
    path("search-global/", AnimalGlobalSearchView.as_view(), name="animals-search-global"),
    path("<uuid:pk>/", AnimalDetailView.as_view(), name="animals-detail"),
    path("<uuid:pk>/approve/", AnimalApproveView.as_view(), name="animals-approve"),
    path("<uuid:pk>/reject/", AnimalRejectView.as_view(), name="animals-reject"),
    path("<uuid:pk>/genealogy/", AnimalGenealogyView.as_view(), name="animals-genealogy"),
    path("<uuid:pk>/foto/", AnimalFotoUploadView.as_view(), name="animals-foto"),
    path("<uuid:pk>/pesaje/", AnimalPesajeView.as_view(), name="animals-pesaje"),
    path("<uuid:pk>/aprobar-reproductor/", AnimalReproductorApproveView.as_view(), name="animals-aprobar-reproductor"),
]
