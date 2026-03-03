"""
Tests para cerrado de Lotes de Cría.
"""
import pytest
from factories import LoteFactory


@pytest.mark.django_db
class TestLoteClose:

    def test_cerrar_lote(self, socio_client, socio_user, tenant):
        """POST /lotes/:id/close/ cierra el lote y establece fecha_fin."""
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant)

        resp = socio_client.post(f"/api/v1/lotes/{lote.id}/close/")

        assert resp.status_code == 200, resp.data
        assert resp.data["is_closed"] is True
        assert resp.data["fecha_fin"] is not None

    def test_cerrar_lote_ya_cerrado(self, socio_client, socio_user, tenant):
        """Cerrar un lote ya cerrado es idempotente — devuelve 200."""
        lote = LoteFactory(
            socio=socio_user.socio,
            tenant=tenant,
            is_closed=True,
            fecha_fin="2024-06-01",
        )

        resp = socio_client.post(f"/api/v1/lotes/{lote.id}/close/")

        assert resp.status_code == 200, resp.data
        assert resp.data["is_closed"] is True
        # fecha_fin no debe cambiar si ya estaba establecida
        assert resp.data["fecha_fin"] == "2024-06-01"

    def test_socio_b_no_puede_cerrar_lote_de_socio_a(
        self, socio_client_b, socio_user, tenant
    ):
        """Un socio no puede cerrar lotes de otro socio."""
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant)

        resp = socio_client_b.post(f"/api/v1/lotes/{lote.id}/close/")

        assert resp.status_code == 403

    def test_gestion_puede_cerrar_cualquier_lote(
        self, gestion_client, socio_user, tenant
    ):
        """Gestión puede cerrar lotes de cualquier socio."""
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant)

        resp = gestion_client.post(f"/api/v1/lotes/{lote.id}/close/")

        assert resp.status_code == 200, resp.data
        assert resp.data["is_closed"] is True
