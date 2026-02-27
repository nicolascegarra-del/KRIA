from django.urls import path
from .views import LoteCloseView, LoteDetailView, LoteListCreateView

urlpatterns = [
    path("", LoteListCreateView.as_view(), name="lotes-list"),
    path("<uuid:pk>/", LoteDetailView.as_view(), name="lotes-detail"),
    path("<uuid:pk>/close/", LoteCloseView.as_view(), name="lotes-close"),
]
