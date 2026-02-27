from django.urls import path
from .views import GranjaListCreateView, GranjaDetailView

urlpatterns = [
    path("", GranjaListCreateView.as_view(), name="granjas-list"),
    path("<uuid:pk>/", GranjaDetailView.as_view(), name="granjas-detail"),
]
