from django.urls import path
from .views import ReproductorListView

urlpatterns = [
    path("", ReproductorListView.as_view(), name="reproductores-list"),
]
