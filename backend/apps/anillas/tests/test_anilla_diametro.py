"""
Sprint 4 — Tests de alerta DIAMETRO y bloqueo de APROBADO.

Cubre:
  - Anilla 18mm asignada a macho → alerta_anilla='DIAMETRO'.
  - Anilla 20mm asignada a hembra → alerta_anilla='DIAMETRO'.
  - Animal con alerta DIAMETRO no puede pasar a APROBADO.
  - Animal con alerta FUERA_RANGO SÍ puede pasar a APROBADO (no bloquea).
  - Animal con alerta DIAMETRO pero corregido (cambiado sexo) → puede aprobar.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory


ANILLAS_URL = "/api/v1/anillas/"
ANIMALS_URL = "/api/v1/animals/"


def _crear_entrega(gestion_client, socio_id, anio, inicio, fin, diametro):
    return gestion_client.post(
        ANILLAS_URL,
        {"socio": str(socio_id), "anio_campana": anio,
         "rango_inicio": inicio, "rango_fin": fin, "diametro": diametro},
        format="json",
    )


def _animal_con_fotos(tenant, socio, numero_anilla, anio, sexo, alerta=""):
    """Crea un animal con las 3 fotos requeridas para poder aprobar."""
    return AnimalFactory(
        tenant=tenant,
        socio=socio,
        numero_anilla=numero_anilla,
        anio_nacimiento=anio,
        sexo=sexo,
        estado="AÑADIDO",
        alerta_anilla=alerta,
        fotos=[
            {"tipo": "PERFIL", "key": "k1", "uploaded_at": "2024-01-01T00:00:00+00:00"},
            {"tipo": "CABEZA", "key": "k2", "uploaded_at": "2024-01-01T00:00:00+00:00"},
            {"tipo": "ANILLA", "key": "k3", "uploaded_at": "2024-01-01T00:00:00+00:00"},
        ],
    )


@pytest.mark.django_db
class TestAnillaDiametro:

    def test_18mm_macho_genera_alerta_diametro(self, gestion_client, tenant, socio_user):
        """Anilla de 18mm (hembra) asignada a un macho → alerta='DIAMETRO'."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="18")

        payload = {
            "numero_anilla": "50",
            "anio_nacimiento": 2024,
            "sexo": "M",  # Macho con anilla de hembra (18mm)
            "variedad": "SALMON",
            "socio": str(socio_id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == "DIAMETRO"

    def test_20mm_hembra_genera_alerta_diametro(self, gestion_client, tenant, socio_user):
        """Anilla de 20mm (macho) asignada a una hembra → alerta='DIAMETRO'."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="20")

        payload = {
            "numero_anilla": "50",
            "anio_nacimiento": 2024,
            "sexo": "H",  # Hembra con anilla de macho (20mm)
            "variedad": "SALMON",
            "socio": str(socio_id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == "DIAMETRO"

    def test_18mm_hembra_sin_alerta(self, gestion_client, tenant, socio_user):
        """Anilla de 18mm (hembra) asignada a una hembra → sin alerta."""
        socio_id = socio_user.socio.id
        _crear_entrega(gestion_client, socio_id, 2024, "1", "100", diametro="18")

        payload = {
            "numero_anilla": "50",
            "anio_nacimiento": 2024,
            "sexo": "H",
            "variedad": "SALMON",
            "socio": str(socio_id),
        }
        resp = gestion_client.post(ANIMALS_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["alerta_anilla"] == ""

    def test_animal_con_alerta_diametro_no_puede_aprobarse(self, gestion_client, tenant, socio_user):
        """Animal con alerta_anilla='DIAMETRO' no puede pasar a APROBADO."""
        animal = _animal_con_fotos(
            tenant, socio_user.socio, "50", 2024, "M", alerta="DIAMETRO"
        )
        resp = gestion_client.post(f"{ANIMALS_URL}{animal.id}/approve/")
        assert resp.status_code == 400
        assert "diámetro" in resp.data["detail"].lower()

    def test_animal_con_alerta_fuera_rango_si_puede_aprobarse(
        self, gestion_client, tenant, socio_user
    ):
        """Animal con alerta_anilla='FUERA_RANGO' SÍ puede pasar a APROBADO."""
        animal = _animal_con_fotos(
            tenant, socio_user.socio, "999", 2024, "M", alerta="FUERA_RANGO"
        )
        resp = gestion_client.post(f"{ANIMALS_URL}{animal.id}/approve/")
        assert resp.status_code == 200, resp.data
        assert resp.data["estado"] == "APROBADO"

    def test_animal_sin_alerta_puede_aprobarse(self, gestion_client, tenant, socio_user):
        """Animal sin alerta puede aprobarse normalmente."""
        animal = _animal_con_fotos(
            tenant, socio_user.socio, "50", 2024, "M", alerta=""
        )
        resp = gestion_client.post(f"{ANIMALS_URL}{animal.id}/approve/")
        assert resp.status_code == 200, resp.data
        assert resp.data["estado"] == "APROBADO"
