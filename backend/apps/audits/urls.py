from django.urls import path
from . import views

urlpatterns = [
    # Configuración (gestión — solo su tenant)
    path("criterios/", views.CriterioEvaluacionListCreateView.as_view()),
    path("criterios/<uuid:pk>/", views.CriterioEvaluacionDetailView.as_view()),
    path("preguntas/", views.PreguntaInstalacionListCreateView.as_view()),
    path("preguntas/<uuid:pk>/", views.PreguntaInstalacionDetailView.as_view()),

    # Configuración (superadmin — cualquier tenant)
    path("superadmin/<uuid:tenant_pk>/criterios/", views.SuperAdminCriteriosView.as_view()),
    path("superadmin/<uuid:tenant_pk>/criterios/<uuid:pk>/", views.SuperAdminCriterioDetailView.as_view()),
    path("superadmin/<uuid:tenant_pk>/preguntas/", views.SuperAdminPreguntasView.as_view()),
    path("superadmin/<uuid:tenant_pk>/preguntas/<uuid:pk>/", views.SuperAdminPreguntaDetailView.as_view()),

    # Sesiones
    path("", views.AuditoriaSessionListCreateView.as_view()),
    path("<uuid:pk>/", views.AuditoriaSessionDetailView.as_view()),
    path("<uuid:pk>/delete-confirm/", views.AuditoriaDeleteConfirmView.as_view()),

    # Animales evaluados (sub-recurso)
    path("<uuid:auditoria_pk>/animales/", views.AuditoriaAnimalListCreateView.as_view()),
    path("<uuid:auditoria_pk>/animales/<uuid:pk>/", views.AuditoriaAnimalDetailView.as_view()),

    # Respuestas instalación (bulk upsert)
    path("<uuid:auditoria_pk>/respuestas/", views.AuditoriaRespuestaBulkView.as_view()),
]
