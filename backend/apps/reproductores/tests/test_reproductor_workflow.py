"""
Sprint 3 — Tests del workflow de candidatos/reproductores.

Cubre:
  - Socio puede marcar su animal como candidato_reproductor.
  - GET /reproductores/candidatos/ lista candidatos pendientes (solo gestión).
  - Gestión aprueba candidato → reproductor_aprobado=True.
  - Gestión deniega candidato → reproductor_aprobado=False.
  - Animal aprobado aparece en catálogo público.
  - Animal denegado NO aparece en catálogo público.
  - Socio no puede acceder a /reproductores/candidatos/ (403).
  - Dashboard incluye contador candidatos_reproductor.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory


CANDIDATOS_URL = "/api/v1/reproductores/candidatos/"
CATALOGO_URL = "/api/v1/reproductores/"
DASHBOARD_URL = "/api/v1/dashboard/tareas-pendientes/"


def _aprobar_reproductor_url(animal_id):
    return f"/api/v1/animals/{animal_id}/aprobar-reproductor/"


@pytest.mark.django_db
class TestReproductorWorkflow:

    def test_candidato_aparece_en_lista_gestion(self, gestion_client, tenant, socio_user):
        """Animal con candidato_reproductor=True aparece en /reproductores/candidatos/."""
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        )
        resp = gestion_client.get(CANDIDATOS_URL)
        assert resp.status_code == 200, resp.data
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) in ids

    def test_aprobado_no_aparece_en_candidatos(self, gestion_client, tenant, socio_user):
        """Animal ya aprobado como reproductor NO aparece en candidatos."""
        AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=True,
        )
        resp = gestion_client.get(CANDIDATOS_URL)
        assert resp.status_code == 200
        # Solo los pendientes (no aprobados) aparecen
        for a in resp.data["results"]:
            assert a["reproductor_aprobado"] is False

    def test_gestion_aprueba_candidato(self, gestion_client, tenant, socio_user):
        """Gestión aprueba candidato → reproductor_aprobado=True."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        )
        resp = gestion_client.post(
            _aprobar_reproductor_url(animal.id),
            {"aprobado": True},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        animal.refresh_from_db()
        assert animal.reproductor_aprobado is True

    def test_gestion_deniega_candidato(self, gestion_client, tenant, socio_user):
        """Gestión deniega candidato → reproductor_aprobado=False."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=True,
        )
        resp = gestion_client.post(
            _aprobar_reproductor_url(animal.id),
            {"aprobado": False, "notas_decision": "No cumple estándares."},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        animal.refresh_from_db()
        assert animal.reproductor_aprobado is False

    def test_animal_aprobado_aparece_en_catalogo(self, gestion_client, api_client, tenant, socio_user):
        """Animal con reproductor_aprobado=True y estado=EVALUADO aparece en catálogo público."""
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=True,
            estado="EVALUADO",
        )
        resp = api_client.get(CATALOGO_URL, HTTP_X_TENANT_SLUG="demo")
        assert resp.status_code == 200
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) in ids

    def test_animal_no_aprobado_no_aparece_en_catalogo(self, api_client, tenant, socio_user):
        """Animal sin reproductor_aprobado no aparece en catálogo."""
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        )
        resp = api_client.get(CATALOGO_URL, HTTP_X_TENANT_SLUG="demo")
        assert resp.status_code == 200
        ids = [str(a["id"]) for a in resp.data["results"]]
        assert str(animal.id) not in ids

    def test_socio_no_puede_ver_candidatos(self, socio_client):
        """Socio obtiene 403 al intentar acceder a /reproductores/candidatos/."""
        resp = socio_client.get(CANDIDATOS_URL)
        assert resp.status_code == 403

    def test_sin_campo_aprobado_devuelve_400(self, gestion_client, tenant, socio_user):
        """POST a aprobar-reproductor sin campo 'aprobado' → 400."""
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio)
        resp = gestion_client.post(
            _aprobar_reproductor_url(animal.id),
            {},
            format="json",
        )
        assert resp.status_code == 400

    def test_dashboard_incluye_candidatos_reproductor(self, gestion_client, tenant, socio_user):
        """DashboardTareasPendientesView incluye contador candidatos_reproductor."""
        AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            candidato_reproductor=True,
            reproductor_aprobado=False,
        )
        resp = gestion_client.get(DASHBOARD_URL)
        assert resp.status_code == 200, resp.data
        assert "candidatos_reproductor" in resp.data
        assert resp.data["candidatos_reproductor"] >= 1
