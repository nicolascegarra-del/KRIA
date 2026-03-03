"""
Pytest fixtures for the AGAMUR test suite.

Test users mirror the seed_admin command to ensure tests reflect real usage:
  - Gestión: admin@agamur.es / agamur2024!  (is_gestion=True)
  - Socio:   socio@agamur.es / socio2024!   (is_gestion=False, has Socio profile)
"""
import pytest
from rest_framework.test import APIClient

from apps.tenants.models import Tenant
from apps.accounts.models import User, Socio


# ── Core fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def tenant(db):
    """Demo tenant — matches the default seed_admin slug."""
    t, _ = Tenant.objects.get_or_create(
        slug="demo",
        defaults={
            "name": "Asociación Demo AGAMUR",
            "is_active": True,
            "primary_color": "#1565C0",
            "secondary_color": "#FBC02D",
        },
    )
    return t


@pytest.fixture
def gestion_user(db, tenant):
    """
    Gestión user — mirrors seed_admin.
    Login: admin@agamur.es / agamur2024!  +  checkbox Gestión = ON
    """
    user, _ = User.objects.get_or_create(
        tenant=tenant,
        email="admin@agamur.es",
        defaults={
            "is_gestion": True,
            "is_superadmin": True,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "first_name": "Admin",
            "last_name": "AGAMUR",
        },
    )
    user.set_password("agamur2024!")
    user.save()
    return user


@pytest.fixture
def socio_user(db, tenant):
    """
    Socio user with a linked Socio profile — mirrors seed_admin.
    Login: socio@agamur.es / socio2024!  +  checkbox Gestión = OFF
    """
    user, _ = User.objects.get_or_create(
        tenant=tenant,
        email="socio@agamur.es",
        defaults={
            "is_gestion": False,
            "is_active": True,
            "first_name": "Socio",
            "last_name": "Demo",
        },
    )
    user.set_password("socio2024!")
    user.save()

    Socio.all_objects.get_or_create(
        tenant=tenant,
        user=user,
        defaults={
            "nombre_razon_social": "Granja Demo S.L.",
            "dni_nif": "12345678A",
            "telefono": "612345678",
            "direccion": "Calle Mayor 1, 28001 Madrid",
            "numero_socio": "0001",
            "codigo_rega": "ES280101000001",
            "estado": Socio.Estado.ALTA,
        },
    )
    return user


@pytest.fixture
def socio_user_b(db, tenant):
    """A second socio for cross-socio permission tests."""
    user, _ = User.objects.get_or_create(
        tenant=tenant,
        email="socio_b@agamur.es",
        defaults={
            "is_gestion": False,
            "is_active": True,
            "first_name": "Segundo",
            "last_name": "Socio",
        },
    )
    user.set_password("socio2024!")
    user.save()

    Socio.all_objects.get_or_create(
        tenant=tenant,
        user=user,
        defaults={
            "nombre_razon_social": "Granja Secundaria S.L.",
            "dni_nif": "87654321B",
            "numero_socio": "0002",
            "codigo_rega": "ES280101000002",
            "estado": Socio.Estado.ALTA,
        },
    )
    return user


# ── API clients ───────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    """Unauthenticated API client."""
    return APIClient()


@pytest.fixture
def gestion_client(db, gestion_user, tenant):
    """
    Authenticated client operating in GESTIÓN mode.
    Mirrors: login with email + password + access_as_gestion=True
    """
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/",
        {
            "email": "admin@agamur.es",
            "password": "agamur2024!",
            "access_as_gestion": True,
        },
        HTTP_X_TENANT_SLUG="demo",
    )
    assert resp.status_code == 200, f"gestion_client login failed: {resp.data}"
    token = resp.data["access"]
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_SLUG="demo",
    )
    return client


@pytest.fixture
def socio_client(db, socio_user, tenant):
    """
    Authenticated client operating in SOCIO mode.
    Mirrors: login with email + password + access_as_gestion=False (no checkbox)
    """
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/",
        {
            "email": "socio@agamur.es",
            "password": "socio2024!",
            "access_as_gestion": False,
        },
        HTTP_X_TENANT_SLUG="demo",
    )
    assert resp.status_code == 200, f"socio_client login failed: {resp.data}"
    token = resp.data["access"]
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_SLUG="demo",
    )
    return client


@pytest.fixture
def socio_client_b(db, socio_user_b, tenant):
    """Authenticated client for the second socio."""
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/",
        {
            "email": "socio_b@agamur.es",
            "password": "socio2024!",
            "access_as_gestion": False,
        },
        HTTP_X_TENANT_SLUG="demo",
    )
    assert resp.status_code == 200, f"socio_client_b login failed: {resp.data}"
    token = resp.data["access"]
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_SLUG="demo",
    )
    return client
