"""
Sprint 5 — Tests del flujo completo de re-alta.

Cubre:
  - Socio solicita re-alta de animal en SOCIO_EN_BAJA → 201, solicitud PENDIENTE.
  - Socio no puede solicitar re-alta de animal en otro estado → 400.
  - Socio no puede solicitar re-alta de animal de otro socio → 403.
  - No se crean solicitudes duplicadas pendientes → 400.
  - Gestión aprueba → animal vuelve a REGISTRADO, fotos vaciadas.
  - Gestión deniega → solicitud DENEGADO, animal permanece en SOCIO_EN_BAJA.
  - Socio no puede acceder a /dashboard/solicitudes-realta/ → 403.
  - Gestión puede listar solicitudes pendientes.
  - Gestión no puede solicitar re-alta (solo socios).
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory


SOLICITUDES_URL = "/api/v1/dashboard/solicitudes-realta/"


def _solicitar_realta_url(animal_id):
    return f"/api/v1/animals/{animal_id}/solicitar-realta/"


def _resolver_url(solicitud_id):
    return f"/api/v1/dashboard/solicitudes-realta/{solicitud_id}/resolver/"


@pytest.mark.django_db
class TestRealtaFlow:

    def test_socio_solicita_realta_de_animal_en_baja(self, socio_client, tenant, socio_user):
        """Socio solicita re-alta de su animal en SOCIO_EN_BAJA → 201."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp.status_code == 201, resp.data
        assert resp.data["estado"] == "PENDIENTE"
        assert str(resp.data["animal"]) == str(animal.id)

    def test_socio_no_puede_solicitar_estado_incorrecto(self, socio_client, tenant, socio_user):
        """Animal en estado REGISTRADO → no se puede solicitar re-alta → 400."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="REGISTRADO"
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp.status_code == 400

    def test_socio_no_puede_solicitar_animal_ajeno(
        self, socio_client, socio_client_b, tenant, socio_user, socio_user_b
    ):
        """Socio A no puede solicitar re-alta del animal de socio B → 403."""
        animal_b = AnimalFactory(
            tenant=tenant, socio=socio_user_b.socio, estado="SOCIO_EN_BAJA"
        )
        resp = socio_client.post(_solicitar_realta_url(animal_b.id), {}, format="json")
        assert resp.status_code == 403

    def test_no_solicitud_duplicada(self, socio_client, tenant, socio_user):
        """Segunda solicitud pendiente sobre el mismo animal → 400."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp1 = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp1.status_code == 201
        resp2 = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp2.status_code == 400

    def test_gestion_aprueba_realta(self, gestion_client, socio_client, tenant, socio_user):
        """Gestión aprueba → animal vuelve a REGISTRADO y fotos se vacían."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            estado="SOCIO_EN_BAJA",
            fotos=[{"tipo": "PERFIL", "key": "k1", "uploaded_at": "2024-01-01T00:00:00+00:00"}],
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp.status_code == 201
        solicitud_id = resp.data["id"]

        resp2 = gestion_client.post(
            _resolver_url(solicitud_id),
            {"accion": "aprobar"},
            format="json",
        )
        assert resp2.status_code == 200, resp2.data
        assert resp2.data["estado"] == "APROBADO"

        animal.refresh_from_db()
        assert animal.estado == Animal.Estado.REGISTRADO
        assert animal.fotos == []

    def test_gestion_deniega_realta(self, gestion_client, socio_client, tenant, socio_user):
        """Gestión deniega → solicitud DENEGADO, animal permanece en SOCIO_EN_BAJA."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp.status_code == 201
        solicitud_id = resp.data["id"]

        resp2 = gestion_client.post(
            _resolver_url(solicitud_id),
            {"accion": "denegar", "notas": "No cumple requisitos."},
            format="json",
        )
        assert resp2.status_code == 200, resp2.data
        assert resp2.data["estado"] == "DENEGADO"

        animal.refresh_from_db()
        assert animal.estado == Animal.Estado.SOCIO_EN_BAJA

    def test_no_resolver_dos_veces(self, gestion_client, socio_client, tenant, socio_user):
        """No se puede resolver una solicitud ya resuelta → 400."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        solicitud_id = resp.data["id"]

        gestion_client.post(_resolver_url(solicitud_id), {"accion": "aprobar"}, format="json")
        resp2 = gestion_client.post(_resolver_url(solicitud_id), {"accion": "denegar"}, format="json")
        assert resp2.status_code == 400

    def test_socio_no_puede_ver_lista_solicitudes(self, socio_client):
        """Socio obtiene 403 al intentar listar /dashboard/solicitudes-realta/."""
        resp = socio_client.get(SOLICITUDES_URL)
        assert resp.status_code == 403

    def test_gestion_lista_solicitudes_pendientes(
        self, gestion_client, socio_client, tenant, socio_user
    ):
        """Gestión ve las solicitudes pendientes en la lista."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")

        resp = gestion_client.get(SOLICITUDES_URL)
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_gestion_no_puede_solicitar_realta(self, gestion_client, tenant, socio_user):
        """Gestión recibe 403 al intentar solicitar re-alta."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp = gestion_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        assert resp.status_code == 403

    def test_accion_invalida_devuelve_400(self, gestion_client, socio_client, tenant, socio_user):
        """POST /resolver/ con accion inválida → 400."""
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio, estado="SOCIO_EN_BAJA"
        )
        resp = socio_client.post(_solicitar_realta_url(animal.id), {}, format="json")
        solicitud_id = resp.data["id"]

        resp2 = gestion_client.post(
            _resolver_url(solicitud_id), {"accion": "ignorar"}, format="json"
        )
        assert resp2.status_code == 400
