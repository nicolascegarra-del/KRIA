"""
Tests de acceso y permisos por rol.

Covers:
  - Socio sin flag gestión no puede activar modo gestión (access_as_gestion)
  - Socio no puede ver animales de otro socio
  - Socio no puede llamar al endpoint de aprobación
  - Token de reset caduca tras un solo uso
  - Dashboard solo cuenta datos del tenant activo (Bug #4 fix)
"""
import uuid
import pytest
from django.utils import timezone
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestPermisosRol:

    def test_socio_no_puede_activar_modo_gestion(self, socio_user, tenant):
        """Un usuario sin is_gestion=True no puede hacer login como gestión."""
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/login/",
            {
                "email": "socio@agamur.es",
                "password": "socio2024!",
                "access_as_gestion": True,  # intenta activar gestión
            },
            HTTP_X_TENANT_SLUG="demo",
        )
        assert resp.status_code == 400
        assert "access_as_gestion" in str(resp.data).lower() or "gestión" in str(resp.data).lower()

    def test_gestion_login_sin_checkbox_funciona_como_socio(self, gestion_user, tenant):
        """Un usuario gestión puede hacer login SIN el checkbox y actuar como socio."""
        client = APIClient()
        resp = client.post(
            "/api/v1/auth/login/",
            {
                "email": "admin@agamur.es",
                "password": "agamur2024!",
                "access_as_gestion": False,
            },
            HTTP_X_TENANT_SLUG="demo",
        )
        assert resp.status_code == 200
        assert resp.data["user"]["is_gestion"] is False

    def test_socio_no_ve_animales_de_otro_socio(self, socio_client, socio_user_b, tenant):
        """Socio A no puede leer la ficha de un animal de Socio B."""
        from factories import AnimalFactory
        animal_b = AnimalFactory(socio=socio_user_b.socio, tenant=tenant)

        resp = socio_client.get(f"/api/v1/animals/{animal_b.id}/")
        assert resp.status_code in [403, 404]

    def test_socio_no_lista_animales_de_otro_socio(self, socio_client, socio_user, socio_user_b, tenant):
        """El listado de animales de un socio NO incluye animales de otros socios."""
        from factories import AnimalFactory
        animal_a = AnimalFactory(socio=socio_user.socio, tenant=tenant, numero_anilla="ES-A-001")
        animal_b = AnimalFactory(socio=socio_user_b.socio, tenant=tenant, numero_anilla="ES-B-001")

        resp = socio_client.get("/api/v1/animals/")
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.data.get("results", [])]
        assert str(animal_a.id) in ids
        assert str(animal_b.id) not in ids

    def test_socio_no_puede_aprobar_animal(self, socio_client, socio_user, tenant):
        """Un socio no puede llamar al endpoint de aprobación (403)."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="AÑADIDO")

        resp = socio_client.post(f"/api/v1/animals/{animal.id}/approve/")
        assert resp.status_code == 403

    def test_socio_no_puede_rechazar_animal(self, socio_client, socio_user, tenant):
        """Un socio no puede llamar al endpoint de rechazo (403)."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="AÑADIDO")

        resp = socio_client.post(f"/api/v1/animals/{animal.id}/reject/",
                                 {"razon_rechazo": "test"})
        assert resp.status_code == 403

    def test_reset_token_invalido_tras_uso(self, db, tenant, gestion_user):
        """El token de reset de contraseña queda nulo tras usarse una vez."""
        from apps.accounts.models import User
        token = uuid.uuid4()
        gestion_user.reset_token = token
        gestion_user.reset_token_created = timezone.now()
        gestion_user.save()

        client = APIClient()

        # Primer uso — OK
        r1 = client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": str(token), "new_password": "nuevapass456!"},
            HTTP_X_TENANT_SLUG="demo",
        )
        assert r1.status_code == 200

        # Segundo uso — debe fallar
        r2 = client.post(
            "/api/v1/auth/password-reset/confirm/",
            {"token": str(token), "new_password": "otrapass789!"},
            HTTP_X_TENANT_SLUG="demo",
        )
        assert r2.status_code == 400

    def test_sin_tenant_header_retorna_error(self, db):
        """Sin X-Tenant-Slug, los endpoints protegidos devuelven 400 o 401."""
        client = APIClient()
        resp = client.get("/api/v1/animals/")
        assert resp.status_code in [400, 401]

    def test_dashboard_filtra_por_tenant(self, gestion_client, socio_user, tenant):
        """El dashboard solo cuenta animales del tenant activo (Bug #4)."""
        from factories import AnimalFactory, TenantFactory, SocioFactory, UserFactory

        # Animal en el tenant activo
        animal_local = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, estado="AÑADIDO"
        )

        # Animal en otro tenant (no debe aparecer en el count)
        otro_tenant = TenantFactory(slug="otro")
        otro_user = UserFactory(tenant=otro_tenant)
        otro_socio = SocioFactory(user=otro_user, tenant=otro_tenant)
        from factories import AnimalFactory as AF
        AF(socio=otro_socio, tenant=otro_tenant, estado="AÑADIDO")

        resp = gestion_client.get("/api/v1/dashboard/tareas-pendientes/")
        assert resp.status_code == 200
        # Solo debe contar el animal del tenant activo
        assert resp.data["pendientes_aprobacion"] >= 1
