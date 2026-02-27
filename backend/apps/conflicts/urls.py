from django.urls import path
from .views import ConflictoListView, ConflictoResolveView, DashboardTareasPendientesView

urlpatterns = [
    path("tareas-pendientes/", DashboardTareasPendientesView.as_view(), name="dashboard-tareas"),
    path("conflictos/", ConflictoListView.as_view(), name="conflictos-list"),
    path("conflictos/<uuid:pk>/resolve/", ConflictoResolveView.as_view(), name="conflictos-resolve"),
]
