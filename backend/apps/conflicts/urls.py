from django.urls import path
from .views import (
    ConflictoListView,
    ConflictoResolveView,
    DashboardTareasPendientesView,
    SolicitudRealtaListView,
    SolicitudRealtaResolveView,
)

urlpatterns = [
    path("tareas-pendientes/", DashboardTareasPendientesView.as_view(), name="dashboard-tareas"),
    path("conflictos/", ConflictoListView.as_view(), name="conflictos-list"),
    path("conflictos/<uuid:pk>/resolve/", ConflictoResolveView.as_view(), name="conflictos-resolve"),
    path("solicitudes-realta/", SolicitudRealtaListView.as_view(), name="solicitudes-realta-list"),
    path("solicitudes-realta/<uuid:pk>/resolver/", SolicitudRealtaResolveView.as_view(), name="solicitudes-realta-resolve"),
]
