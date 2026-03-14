from django.urls import path
from .superadmin_views import (
    SuperAdminStatsView,
    SuperAdminTenantDetailView,
    SuperAdminTenantListCreateView,
    SuperAdminTenantLogoView,
    SuperAdminUserResetPasswordView,
)

urlpatterns = [
    path("tenants/", SuperAdminTenantListCreateView.as_view(), name="superadmin-tenants-list"),
    path("tenants/<uuid:pk>/", SuperAdminTenantDetailView.as_view(), name="superadmin-tenants-detail"),
    path("tenants/<uuid:pk>/logo/", SuperAdminTenantLogoView.as_view(), name="superadmin-tenants-logo"),
    path("users/<uuid:pk>/reset-password/", SuperAdminUserResetPasswordView.as_view(), name="superadmin-user-reset"),
    path("stats/", SuperAdminStatsView.as_view(), name="superadmin-stats"),
]
