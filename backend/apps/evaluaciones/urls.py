from django.urls import path
from .views import EvaluacionDetailView, EvaluacionListCreateView

urlpatterns = [
    path("", EvaluacionListCreateView.as_view(), name="evaluaciones-list"),
    path("<uuid:pk>/", EvaluacionDetailView.as_view(), name="evaluaciones-detail"),
]
