"""
Tests para árbol genealógico con nodos Lote.
"""
import pytest
from factories import AnimalFactory, LoteFactory


@pytest.mark.django_db
class TestLoteGenealogy:

    def test_animal_con_madre_lote_en_arbol(self, socio_client, socio_user, tenant):
        """GET /animals/:id/genealogy/ con madre_lote retorna nodo tipo LOTE."""
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)
        cria = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, sexo="H", madre_lote=lote
        )

        resp = socio_client.get(f"/api/v1/animals/{cria.id}/genealogy/")

        assert resp.status_code == 200, resp.data
        madre_node = resp.data["tree"]["madre"]
        assert madre_node is not None
        assert madre_node["tipo"] == "LOTE"
        assert madre_node["anilla"] == lote.nombre

    def test_nodo_lote_incluye_macho(self, socio_client, socio_user, tenant):
        """El nodo LOTE en el árbol incluye el macho como padre."""
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)
        cria = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, sexo="H", madre_lote=lote
        )

        resp = socio_client.get(f"/api/v1/animals/{cria.id}/genealogy/")

        assert resp.status_code == 200, resp.data
        madre_node = resp.data["tree"]["madre"]
        assert madre_node["padre"] is not None
        assert madre_node["padre"]["anilla"] == macho.numero_anilla
        assert madre_node["padre"]["tipo"] == "ANIMAL"

    def test_lote_sin_macho_padre_es_null(self, socio_client, socio_user, tenant):
        """Si el lote no tiene macho, el padre del nodo LOTE es null."""
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=None)
        cria = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, sexo="H", madre_lote=lote
        )

        resp = socio_client.get(f"/api/v1/animals/{cria.id}/genealogy/")

        assert resp.status_code == 200, resp.data
        madre_node = resp.data["tree"]["madre"]
        assert madre_node["tipo"] == "LOTE"
        assert madre_node["padre"] is None

    def test_madre_animal_y_madre_lote_exclusivos(self, socio_client, socio_user, tenant):
        """POST /animals/ con madre_animal y madre_lote a la vez devuelve 400."""
        madre = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)

        resp = socio_client.post("/api/v1/animals/", {
            "numero_anilla": "ES-DUAL-001",
            "anio_nacimiento": 2024,
            "sexo": "H",
            "variedad": "SALMON",
            "madre_animal": str(madre.id),
            "madre_lote": str(lote.id),
        }, format="json")

        assert resp.status_code == 400
