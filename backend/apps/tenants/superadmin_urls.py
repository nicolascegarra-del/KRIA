from django.urls import path
from .superadmin_views import (
    SuperAdminStatsView,
    SuperAdminTenantActivateView,
    SuperAdminTenantDetailView,
    SuperAdminTenantListCreateView,
    SuperAdminTenantLogoView,
    SuperAdminTenantSuspendView,
    SuperAdminImpersonateView,
    SuperAdminTenantUsersView,
    SuperAdminUserDetailView,
    SuperAdminUserSuspendView,
    SuperAdminUserActivateView,
    SuperAdminUserResetPasswordView,
    SuperAdminAdminUsersListView,
    SuperAdminSuperAdminListCreateView,
    SuperAdminSuperAdminDetailView,
    PlatformSettingsView,
    PlatformSmtpTestView,
    TenantSmtpTestView,
    SuperAdminTenantDeleteSociosView,
    SuperAdminTenantDeleteAnillasView,
    SuperAdminTenantDeleteAnimalesView,
    SuperAdminRunHealthCheckView,
    SuperAdminFixAccessLogTenantsView,
    SuperAdminLogsView,
    SuperAdminMailLogView,
    SuperAdminClearAccessLogView,
    SuperAdminClearMailLogView,
)

urlpatterns = [
    # Asociaciones
    path("tenants/", SuperAdminTenantListCreateView.as_view(), name="superadmin-tenants-list"),
    path("tenants/<uuid:pk>/", SuperAdminTenantDetailView.as_view(), name="superadmin-tenants-detail"),
    path("tenants/<uuid:pk>/logo/", SuperAdminTenantLogoView.as_view(), name="superadmin-tenants-logo"),
    path("tenants/<uuid:pk>/suspend/", SuperAdminTenantSuspendView.as_view(), name="superadmin-tenants-suspend"),
    path("tenants/<uuid:pk>/activate/", SuperAdminTenantActivateView.as_view(), name="superadmin-tenants-activate"),
    path("tenants/<uuid:pk>/impersonate/", SuperAdminImpersonateView.as_view(), name="superadmin-tenants-impersonate"),
    path("tenants/<uuid:pk>/users/", SuperAdminTenantUsersView.as_view(), name="superadmin-tenants-users"),
    path("tenants/<uuid:pk>/test-smtp/", TenantSmtpTestView.as_view(), name="superadmin-tenants-test-smtp"),
    path("tenants/<uuid:pk>/delete-socios/", SuperAdminTenantDeleteSociosView.as_view(), name="superadmin-tenant-delete-socios"),
    path("tenants/<uuid:pk>/delete-anillas/", SuperAdminTenantDeleteAnillasView.as_view(), name="superadmin-tenant-delete-anillas"),
    path("tenants/<uuid:pk>/delete-animales/", SuperAdminTenantDeleteAnimalesView.as_view(), name="superadmin-tenant-delete-animales"),
    # Usuarios admin (gestión, no superadmin)
    path("admin-users/", SuperAdminAdminUsersListView.as_view(), name="superadmin-admin-users-list"),
    path("users/<uuid:pk>/", SuperAdminUserDetailView.as_view(), name="superadmin-user-detail"),
    path("users/<uuid:pk>/suspend/", SuperAdminUserSuspendView.as_view(), name="superadmin-user-suspend"),
    path("users/<uuid:pk>/activate/", SuperAdminUserActivateView.as_view(), name="superadmin-user-activate"),
    path("users/<uuid:pk>/reset-password/", SuperAdminUserResetPasswordView.as_view(), name="superadmin-user-reset"),
    # SuperAdmins
    path("superadmins/", SuperAdminSuperAdminListCreateView.as_view(), name="superadmin-superadmins-list"),
    path("superadmins/<uuid:pk>/", SuperAdminSuperAdminDetailView.as_view(), name="superadmin-superadmins-detail"),
    # Stats
    path("stats/", SuperAdminStatsView.as_view(), name="superadmin-stats"),
    # Health check manual
    path("run-health-check/", SuperAdminRunHealthCheckView.as_view(), name="superadmin-run-health-check"),
    # Fix histórico de logs sin tenant
    path("fix-access-log-tenants/", SuperAdminFixAccessLogTenantsView.as_view(), name="superadmin-fix-access-log-tenants"),
    # Platform settings (SMTP global)
    path("settings/", PlatformSettingsView.as_view(), name="superadmin-platform-settings"),
    path("settings/test-smtp/", PlatformSmtpTestView.as_view(), name="superadmin-platform-test-smtp"),
    # Access logs
    path("logs/", SuperAdminLogsView.as_view(), name="superadmin-logs"),
    path("logs/clear/", SuperAdminClearAccessLogView.as_view(), name="superadmin-logs-clear"),
    # Mail log
    path("mail-log/", SuperAdminMailLogView.as_view(), name="superadmin-mail-log"),
    path("mail-log/clear/", SuperAdminClearMailLogView.as_view(), name="superadmin-mail-log-clear"),
]
