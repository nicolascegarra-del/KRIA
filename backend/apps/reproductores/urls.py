from django.urls import path
from .views import CandidatosReproductorView, ReproductorListView

urlpatterns = [
    path("", ReproductorListView.as_view(), name="reproductores-list"),
    path("candidatos/", CandidatosReproductorView.as_view(), name="reproductores-candidatos"),
]
