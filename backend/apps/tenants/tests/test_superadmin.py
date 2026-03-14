"""
Sprint 8 — Tests de la API SuperAdmin.

Cubre:
  - GET /superadmin/tenants/ lista todos los tenants (solo superadmin).
  - POST /superadmin/tenants/ crea un nuevo tenant.
  - GET/PUT /superadmin/tenants/:id/ obtiene y edita un tenant.
  - GET /superadmin/stats/ devuelve estadísticas globales.
  - POST /superadmin/users/:id/reset-password/ genera un token de reset.
  - Gestión no superadmin recibe 403.
  - Socio recibe 403.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import TenantFactory, UserFactory, SocioFactory


TENANTS_URL = "/api/v1/superadmin/tenants/"
STATS_URL = "/api/v1/superadmin/stats/"


@pytest.mark.django_db
class TestSuperAdminTenantCRUD:

    def test_superadmin_lista_tenants(self, gestion_client, tenant):
        """Superadmin puede listar todos los tenants."""
        resp = gestion_client.get(TENANTS_URL)
        assert resp.status_code == 200
        # Al menos el tenant 'demo' está presente
        slugs = [t["slug"] for t in resp.data["results"]]
        assert "demo" in slugs

    def test_superadmin_crea_tenant(self, gestion_client):
        """Superadmin puede crear un nuevo tenant."""
        payload = {
            "name": "Asociación Nueva",
            "slug": "nueva-asoc",
            "primary_color": "#FF0000",
            "secondary_color": "#00FF00",
            "is_active": True,
        }
        resp = gestion_client.post(TENANTS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["slug"] == "nueva-asoc"

    def test_superadmin_edita_tenant(self, gestion_client, tenant):
        """Superadmin puede editar nombre e colores de un tenant."""
        resp = gestion_client.patch(
            f"{TENANTS_URL}{tenant.id}/",
            {"name": "Nombre Actualizado"},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        assert resp.data["name"] == "Nombre Actualizado"

    def test_superadmin_stats(self, gestion_client, tenant):
        """GET /superadmin/stats/ devuelve contadores globales."""
        resp = gestion_client.get(STATS_URL)
        assert resp.status_code == 200
        assert "tenants" in resp.data
        assert "usuarios" in resp.data
        assert "socios" in resp.data
        assert "animales" in resp.data
        assert resp.data["tenants"] >= 1

    def test_superadmin_reset_password(self, gestion_client, gestion_user):
        """POST /superadmin/users/:id/reset-password/ devuelve token."""
        resp = gestion_client.post(f"/api/v1/superadmin/users/{gestion_user.id}/reset-password/")
        assert resp.status_code == 200, resp.data
        assert "reset_token" in resp.data
        assert resp.data["email"] == gestion_user.email

    def test_gestion_no_superadmin_recibe_403(self, tenant):
        """Usuario gestión sin is_superadmin no puede acceder al superadmin API."""
        from rest_framework.test import APIClient
        from factories import UserFactory

        # Crear usuario gestión sin is_superadmin
        non_super = UserFactory(tenant=tenant, is_gestion=True, is_superadmin=False)
        non_super.set_password("test123!")
        non_super.save()

        client = APIClient()
        resp = client.post(
            "/api/v1/auth/login/",
            {"email": non_super.email, "password": "test123!", "access_as_gestion": True},
            HTTP_X_TENANT_SLUG="demo",
        )
        assert resp.status_code == 200
        token = resp.data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_SLUG="demo")

        resp2 = client.get(TENANTS_URL)
        assert resp2.status_code == 403

    def test_socio_recibe_403(self, socio_client):
        """Socio no puede acceder al superadmin API → 403."""
        resp = socio_client.get(TENANTS_URL)
        assert resp.status_code == 403
