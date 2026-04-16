from django.urls import path
from . import views

urlpatterns = [
    path("", views.TablaControlListCreateView.as_view()),
    path("socio-fields/", views.SocioFieldsView.as_view()),
    path("<uuid:pk>/", views.TablaControlDetailView.as_view()),
    path("<uuid:pk>/filas/", views.TablaFilasView.as_view()),
    path("<uuid:pk>/filas/<uuid:socio_id>/", views.TablaEntradaUpdateView.as_view()),
    path("<uuid:pk>/sync-socios/", views.TablaSyncSociosView.as_view()),
    path("<uuid:pk>/export/", views.TablaExportView.as_view()),
]
