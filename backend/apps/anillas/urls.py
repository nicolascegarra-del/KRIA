from django.urls import path
from .views import AnillaCheckView, EntregaAnillasDetailView, EntregaAnillasListCreateView

urlpatterns = [
    path("", EntregaAnillasListCreateView.as_view(), name="anillas-list"),
    path("check/", AnillaCheckView.as_view(), name="anillas-check"),
    path("<uuid:pk>/", EntregaAnillasDetailView.as_view(), name="anillas-detail"),
]
