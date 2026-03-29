"""
Sprint 7 — Tests de filtros del catálogo de reproductores.

Cubre:
  - Solo animales con reproductor_aprobado=True Y estado=EVALUADO aparecen
    en el catálogo público (GET /reproductores/).
  - Animal aprobado pero no evaluado NO aparece en el catálogo público.
  - El job del catálogo crea un ReportJob correctamente.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory


CATALOGO_URL = "/api/v1/reproductores/"


@pytest.mark.django_db
class TestCatalogoFiltros:

    def test_animal_aprobado_y_evaluado_aparece(self, api_client, tenant, socio_user):
        """Animal con reproductor_aprobado=True y estado=EVALUADO → aparece en catálogo."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            reproductor_aprobado=True, estado="EVALUADO",
        )
        resp = api_client.get(CATALOGO_URL, HTTP_X_TENANT_SLUG="demo")
        assert resp.status_code == 200
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) in ids

    def test_animal_aprobado_no_evaluado_no_aparece(self, api_client, tenant, socio_user):
        """Animal aprobado como reproductor pero en estado APROBADO (no EVALUADO) → no aparece."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            reproductor_aprobado=True, estado="APROBADO",
        )
        resp = api_client.get(CATALOGO_URL, HTTP_X_TENANT_SLUG="demo")
        assert resp.status_code == 200
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) not in ids

    def test_animal_no_aprobado_no_aparece(self, api_client, tenant, socio_user):
        """Animal con reproductor_aprobado=False → no aparece en catálogo."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            reproductor_aprobado=False, estado="EVALUADO",
        )
        resp = api_client.get(CATALOGO_URL, HTTP_X_TENANT_SLUG="demo")
        assert resp.status_code == 200
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) not in ids

    def test_crear_job_catalogo(self, gestion_client, tenant):
        """POST /reports/catalogo-reproductores/ crea un ReportJob y devuelve 202."""
        from unittest.mock import patch
        with patch("apps.reports.tasks.generate_report.delay"):
            resp = gestion_client.post("/api/v1/reports/catalogo-reproductores/")
        assert resp.status_code == 202
        assert "job_id" in resp.data
