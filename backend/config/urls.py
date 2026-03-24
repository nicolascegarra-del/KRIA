from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok", "service": "kria-backend"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/tenants/", include("apps.tenants.urls")),
    path("api/v1/socios/", include("apps.accounts.socios_urls")),
    path("api/v1/animals/", include("apps.animals.urls")),
    path("api/v1/lotes/", include("apps.lotes.urls")),
    path("api/v1/evaluaciones/", include("apps.evaluaciones.urls")),
    path("api/v1/reproductores/", include("apps.reproductores.urls")),
    path("api/v1/imports/", include("apps.imports.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/dashboard/", include("apps.conflicts.urls")),
    path("api/v1/granjas/", include("apps.granjas.urls")),
    path("api/v1/anillas/", include("apps.anillas.urls")),
    path("api/v1/documentos/", include("apps.documentos.urls")),
    path("api/v1/superadmin/", include("apps.tenants.superadmin_urls")),
    path("api/v1/configuracion/", include("apps.animals.configuracion_urls")),
]
