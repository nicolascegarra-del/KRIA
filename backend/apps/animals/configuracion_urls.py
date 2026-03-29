from django.urls import path
from .views import MotivoBajaListCreateView, MotivoBajaDetailView

urlpatterns = [
    path("motivos-baja/", MotivoBajaListCreateView.as_view(), name="motivos-baja-list"),
    path("motivos-baja/<uuid:pk>/", MotivoBajaDetailView.as_view(), name="motivos-baja-detail"),
]
