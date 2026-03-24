"""
Sprint — Tests SuperAdmin v2.

Cubre:
  1. DELETE /superadmin/tenants/:id/ → 204, tenant eliminado + cascade usuarios
  2. POST /superadmin/tenants/:id/suspend/ → is_active=False
  3. POST /superadmin/tenants/:id/activate/ → is_active=True
  4. Suspender tenant del sistema → 400
  5. POST /superadmin/tenants/ con gestion_user → crea tenant + usuario gestión
  6. POST /superadmin/tenants/ sin gestion_user → crea solo tenant
  7. Rollback por email duplicado al crear tenant con gestion_user
  8. POST /superadmin/tenants/:id/impersonate/ → devuelve token JWT válido
  9. Impersonar tenant inactivo → 400
  10. Token de impersonación tiene claims correctos
  11. Llamada real con token impersonado → accede a datos del tenant impersonado
  12. No superadmin no puede impersonar → 403
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from rest_framework.test import APIClient
from factories import TenantFactory, UserFactory

from apps.tenants.models import Tenant
from apps.accounts.models import User

TENANTS_URL = "/api/v1/superadmin/tenants/"


@pytest.mark.django_db
class TestSuperAdminTenantDelete:

    def test_delete_tenant_cascade(self, gestion_client, tenant):
        """DELETE elimina el tenant y en cascada sus usuarios."""
        other = TenantFactory(slug="para-borrar")
        u = UserFactory(tenant=other, is_gestion=True)
        user_id = u.id
        tenant_id = other.id

        resp = gestion_client.delete(f"{TENANTS_URL}{other.id}/")
        assert resp.status_code == 204

        assert not Tenant.objects.filter(id=tenant_id).exists()
        assert not User.objects.filter(id=user_id).exists()

    def test_delete_returns_404_for_unknown(self, gestion_client):
        import uuid
        fake_id = uuid.uuid4()
        resp = gestion_client.delete(f"{TENANTS_URL}{fake_id}/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestSuperAdminSuspendActivate:

    def test_suspend_tenant(self, gestion_client, tenant):
        resp = gestion_client.post(f"{TENANTS_URL}{tenant.id}/suspend/")
        assert resp.status_code == 200
        assert resp.data["is_active"] is False
        tenant.refresh_from_db()
        assert tenant.is_active is False

    def test_activate_tenant(self, gestion_client):
        """Activar un tenant inactivo (que no sea el demo tenant del cliente)."""
        other = TenantFactory(slug="asoc-inactiva", is_active=False)
        resp = gestion_client.post(f"{TENANTS_URL}{other.id}/activate/")
        assert resp.status_code == 200
        assert resp.data["is_active"] is True
        other.refresh_from_db()
        assert other.is_active is True

    def test_suspend_system_tenant_blocked(self, gestion_client):
        """El tenant 'system' no se puede suspender."""
        system, _ = Tenant.objects.get_or_create(
            slug="system",
            defaults={"name": "System", "is_active": True},
        )
        resp = gestion_client.post(f"{TENANTS_URL}{system.id}/suspend/")
        assert resp.status_code == 400

    def test_suspend_unknown_tenant(self, gestion_client):
        import uuid
        resp = gestion_client.post(f"{TENANTS_URL}{uuid.uuid4()}/suspend/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestSuperAdminCreateWithGestionUser:

    def test_create_tenant_with_gestion_user(self, gestion_client):
        """POST con gestion_user crea tenant + usuario de gestión."""
        payload = {
            "name": "Asoc Con Gestor",
            "slug": "asoc-con-gestor",
            "primary_color": "#123456",
            "secondary_color": "#654321",
            "is_active": True,
            "gestion_user": {
                "email": "gestor@asoc-con-gestor.es",
                "first_name": "Gestor",
                "last_name": "Prueba",
                "password": "password123!",
            },
        }
        resp = gestion_client.post(TENANTS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["slug"] == "asoc-con-gestor"

        tenant = Tenant.objects.get(slug="asoc-con-gestor")
        assert User.objects.filter(tenant=tenant, email="gestor@asoc-con-gestor.es", is_gestion=True).exists()

    def test_create_tenant_without_gestion_user(self, gestion_client):
        """POST sin gestion_user crea solo el tenant."""
        payload = {
            "name": "Asoc Sin Gestor",
            "slug": "asoc-sin-gestor",
            "primary_color": "#111111",
            "secondary_color": "#222222",
            "is_active": True,
        }
        resp = gestion_client.post(TENANTS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        tenant = Tenant.objects.get(slug="asoc-sin-gestor")
        # No gestion user created
        assert not User.objects.filter(tenant=tenant).exists()

    def test_create_tenant_with_invalid_gestion_user_rolls_back(self, gestion_client):
        """Si gestion_user tiene datos inválidos, no se crea el tenant."""
        payload = {
            "name": "Asoc Rollback",
            "slug": "asoc-rollback",
            "primary_color": "#111111",
            "secondary_color": "#222222",
            "is_active": True,
            "gestion_user": {
                "email": "not-an-email",
                "password": "short",
            },
        }
        resp = gestion_client.post(TENANTS_URL, payload, format="json")
        assert resp.status_code == 400
        # Tenant should NOT have been created
        assert not Tenant.objects.filter(slug="asoc-rollback").exists()


@pytest.mark.django_db
class TestSuperAdminImpersonate:

    def test_impersonate_returns_token(self, gestion_client, tenant):
        resp = gestion_client.post(f"{TENANTS_URL}{tenant.id}/impersonate/")
        assert resp.status_code == 200, resp.data
        assert "access" in resp.data
        assert resp.data["tenant"]["slug"] == tenant.slug

    def test_impersonate_inactive_tenant_returns_400(self, gestion_client):
        other = TenantFactory(slug="asoc-suspendida", is_active=False)
        resp = gestion_client.post(f"{TENANTS_URL}{other.id}/impersonate/")
        assert resp.status_code == 400

    def test_impersonate_token_has_correct_claims(self, gestion_client, tenant):
        import jwt as pyjwt
        resp = gestion_client.post(f"{TENANTS_URL}{tenant.id}/impersonate/")
        assert resp.status_code == 200
        token_str = resp.data["access"]
        # Decode without verifying signature to inspect claims
        payload = pyjwt.decode(token_str, options={"verify_signature": False})
        assert payload["tenant_slug"] == tenant.slug
        assert payload["is_gestion"] is True
        assert payload["impersonating"] is True

    def test_impersonate_unknown_tenant(self, gestion_client):
        import uuid
        resp = gestion_client.post(f"{TENANTS_URL}{uuid.uuid4()}/impersonate/")
        assert resp.status_code == 404

    def test_non_superadmin_cannot_impersonate(self, tenant):
        """Usuario gestión sin is_superadmin recibe 403."""
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

        resp2 = client.post(f"{TENANTS_URL}{tenant.id}/impersonate/")
        assert resp2.status_code == 403

    def test_impersonated_token_can_access_tenant_data(self, gestion_client, tenant):
        """Token de impersonación permite llamadas autenticadas al tenant."""
        resp = gestion_client.post(f"{TENANTS_URL}{tenant.id}/impersonate/")
        assert resp.status_code == 200

        imp_token = resp.data["access"]
        imp_client = APIClient()
        imp_client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {imp_token}",
            HTTP_X_TENANT_SLUG=tenant.slug,
        )
        # A gestión endpoint — socios list
        socios_resp = imp_client.get("/api/v1/socios/")
        assert socios_resp.status_code in (200, 404)  # 200 si hay socios, igual no 401/403
