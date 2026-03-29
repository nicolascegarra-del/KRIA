from django.urls import path
from .views import NotificacionListView, NotificacionMarkReadView, NotificacionDeleteView

urlpatterns = [
    path("", NotificacionListView.as_view(), name="notificaciones-list"),
    path("marcar-leidas/", NotificacionMarkReadView.as_view(), name="notificaciones-mark-read"),
    path("<uuid:pk>/delete/", NotificacionDeleteView.as_view(), name="notificaciones-delete"),
]
