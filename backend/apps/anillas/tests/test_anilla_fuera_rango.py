"""
Sprint 4 — Tests de alerta FUERA_RANGO.

Cubre:
  - Crear animal con anilla fuera del rango asignado → alerta_anilla="FUERA_RANGO".
  - Crear animal con anilla dentro del rango → sin alerta.
  - Sin entregas asignadas para el socio/año → sin alerta.
  - El endpoint /anillas/check/ devuelve FUERA_RANGO correctamente.
  - Gestión puede crear/listar/eliminar entregas de anillas.
  - Socio no puede acceder a /api/v1/anillas/ (403).
  - Dashboard incluye contador alertas_anilla.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory, SocioFactory


ANILLAS_URL = "/api/v1/anillas/"
ANIMALS_URL = "/api/v1/animals/"
DASHBOARD_URL = "/api/v1/dashboard/tareas-pendientes/"


def _crear_entrega(gestion_client, socio_id, anio, inicio, fin, diametro="20"):
    return gestion_client.post(
        ANILLAS_URL,
        {
            "socio": str(socio_id),
            "anio_campana": anio,
            "rango_inicio": inicio,
            "rango_fin": fin,
            "diametro": diametro,
        },
        format="json",
    )


@pytest.mark.django_db
class TestAnillaFueraRango:

    def test_sin_entrega_no_hay_alerta(self, gestion_client, tenant, socio_user):
        """Sin rangos asignados al socio, no se genera ninguna alerta."""
        payload = {
            "numero_anilla": "500",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "socio": str(socio_user.socio.id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == ""

    def test_animal_en_rango_sin_alerta(self, gestion_client, tenant, socio_user):
        """Anilla dentro del rango asignado → sin alerta."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="20")

        payload = {
            "numero_anilla": "50",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "socio": str(socio_id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == ""

    def test_animal_fuera_rango_alerta(self, gestion_client, tenant, socio_user):
        """Anilla fuera del rango asignado → alerta_anilla='FUERA_RANGO'."""
        socio_id = socio_user.socio.id
        resp_e = _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="20")
        assert resp_e.status_code == 201, resp_e.data

        payload = {
            "numero_anilla": "999",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "socio": str(socio_id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == "FUERA_RANGO"

    def test_endpoint_check_fuera_rango(self, gestion_client, tenant, socio_user):
        """GET /anillas/check/ devuelve FUERA_RANGO para anilla fuera de rango."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="20")

        resp = gestion_client.get(
            f"/api/v1/anillas/check/?anilla=999&anio=2024&socio_id={socio_id}&sexo=M"
        )
        assert resp.status_code == 200, resp.data
        assert resp.data["alerta"] == "FUERA_RANGO"

    def test_endpoint_check_en_rango(self, gestion_client, tenant, socio_user):
        """GET /anillas/check/ devuelve '' para anilla dentro del rango."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="20")

        resp = gestion_client.get(
            f"/api/v1/anillas/check/?anilla=50&anio=2024&socio_id={socio_id}&sexo=M"
        )
        assert resp.status_code == 200, resp.data
        assert resp.data["alerta"] == ""

    def test_gestion_crud_entregas(self, gestion_client, tenant, socio_user):
        """Gestión puede crear, listar y eliminar entregas de anillas."""
        socio_id = socio_user.socio.id

        # Crear
        resp = _crear_entrega(gestion_client, socio_id, 2024, "1", "200", diametro="18")
        assert resp.status_code == 201, resp.data
        entrega_id = resp.data["id"]

        # Listar
        resp2 = gestion_client.get(ANILLAS_URL)
        assert resp2.status_code == 200
        assert resp2.data["count"] >= 1

        # Eliminar
        resp3 = gestion_client.delete(f"{ANILLAS_URL}{entrega_id}/")
        assert resp3.status_code == 204

    def test_socio_no_puede_acceder_anillas(self, socio_client):
        """Socio obtiene 403 al intentar acceder a /api/v1/anillas/."""
        resp = socio_client.get(ANILLAS_URL)
        assert resp.status_code == 403

    def test_rango_invalido_inicio_mayor_que_fin(self, gestion_client, tenant, socio_user):
        """Crear entrega con rango_inicio > rango_fin (numérico) → 400."""
        resp = _crear_entrega(
            gestion_client, socio_user.socio.id, 2024, "200", "100", diametro="20"
        )
        assert resp.status_code == 400

    def test_dashboard_incluye_alertas_anilla(self, gestion_client, tenant, socio_user):
        """DashboardTareasPendientesView incluye contador alertas_anilla."""
        from apps.animals.models import Animal
        # Crear animal con alerta de anilla directamente
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            alerta_anilla="FUERA_RANGO",
        )
        resp = gestion_client.get(DASHBOARD_URL)
        assert resp.status_code == 200, resp.data
        assert "alertas_anilla" in resp.data
        assert resp.data["alertas_anilla"] >= 1
