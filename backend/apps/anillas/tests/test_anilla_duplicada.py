"""
Sprint 4 — Tests de unicidad de anilla (ya existente desde Sprint 1, verificación).

Cubre:
  - Misma anilla + mismo año en el mismo tenant → 400 (unique_together).
  - Misma anilla + mismo año en diferente tenant → OK (cada tenant es independiente).
  - Actualizar un animal existente con la misma anilla/año → OK.
  - Filtrado por anio y socio_id en GET /api/v1/anillas/.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory, TenantFactory, SocioFactory, UserFactory


ANIMALS_URL = "/api/v1/animals/"
ANILLAS_URL = "/api/v1/anillas/"


@pytest.mark.django_db
class TestAnillaDuplicada:

    def test_misma_anilla_mismo_tenant_400(self, gestion_client, tenant, socio_user):
        """Mismo numero_anilla + anio_nacimiento en el mismo tenant → 409 (conflicto)."""
        # Crear el primer animal
        AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            numero_anilla="DUP-001",
            anio_nacimiento=2024,
        )
        # Intentar crear otro con la misma anilla/año, otro socio → conflicto
        from factories import SocioFactory, UserFactory
        otro_user = UserFactory(tenant=tenant, is_gestion=False)
        otro_socio = SocioFactory(tenant=tenant, user=otro_user)

        payload = {
            "numero_anilla": "DUP-001",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "socio": str(otro_socio.id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        # El sistema registra un conflicto (409) en lugar de 400
        assert resp.status_code == 409

    def test_misma_anilla_mismo_socio_actualiza(self, gestion_client, tenant, socio_user):
        """Mismo numero_anilla + anio del mismo socio → actualiza (200), no crea duplicado."""
        AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            numero_anilla="UPD-001",
            anio_nacimiento=2024,
            sexo="M",
        )
        payload = {
            "numero_anilla": "UPD-001",
            "anio_nacimiento": 2024,
            "sexo": "H",  # Cambia sexo
            "variedad": "PLATA",
            "socio": str(socio_user.socio.id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 200, resp.data
        assert resp.data["sexo"] == "H"

    def test_misma_anilla_distinto_tenant_genera_conflicto(self, gestion_client, tenant, socio_user):
        """
        Misma anilla en un tenant diferente con socio activo →
        el sistema registra un conflicto (409) porque la búsqueda es global
        (para evitar que el mismo animal esté en dos asociaciones simultáneamente).
        """
        otro_tenant = TenantFactory()
        otro_user = UserFactory(tenant=otro_tenant)
        otro_socio = SocioFactory(tenant=otro_tenant, user=otro_user)
        AnimalFactory(
            tenant=otro_tenant,
            socio=otro_socio,
            numero_anilla="CROSS-001",
            anio_nacimiento=2024,
        )
        payload = {
            "numero_anilla": "CROSS-001",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "socio": str(socio_user.socio.id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        # La búsqueda global detecta el animal en otro tenant → conflicto
        assert resp.status_code == 409
        assert "conflict_id" in resp.data

    def test_filtro_anillas_por_anio(self, gestion_client, tenant, socio_user):
        """GET /api/v1/anillas/?anio=2024 filtra correctamente por año de campaña."""
        socio_id = socio_user.socio.id
        gestion_client.post(
            ANILLAS_URL,
            {"socio": str(socio_id), "anio_campana": 2024,
             "rango_inicio": "1", "rango_fin": "100", "diametro": "20"},
            format="json",
        )
        gestion_client.post(
            ANILLAS_URL,
            {"socio": str(socio_id), "anio_campana": 2025,
             "rango_inicio": "1", "rango_fin": "100", "diametro": "20"},
            format="json",
        )
        resp = gestion_client.get(f"{ANILLAS_URL}?anio=2024")
        assert resp.status_code == 200
        for entrega in resp.data["results"]:
            assert entrega["anio_campana"] == 2024

    def test_filtro_anillas_por_socio_id(self, gestion_client, tenant, socio_user, socio_user_b):
        """GET /api/v1/anillas/?socio_id=X filtra correctamente por socio."""
        socio_a_id = socio_user.socio.id
        socio_b_id = socio_user_b.socio.id

        gestion_client.post(
            ANILLAS_URL,
            {"socio": str(socio_a_id), "anio_campana": 2024,
             "rango_inicio": "1", "rango_fin": "50", "diametro": "20"},
            format="json",
        )
        gestion_client.post(
            ANILLAS_URL,
            {"socio": str(socio_b_id), "anio_campana": 2024,
             "rango_inicio": "51", "rango_fin": "100", "diametro": "18"},
            format="json",
        )
        resp = gestion_client.get(f"{ANILLAS_URL}?socio_id={socio_a_id}")
        assert resp.status_code == 200
        for entrega in resp.data["results"]:
            assert str(entrega["socio"]) == str(socio_a_id)
