"""
Tests para creación de Lotes de Cría y serializer enriquecido.
"""
import pytest
from factories import AnimalFactory, LoteFactory


@pytest.mark.django_db
class TestLoteCreate:

    def test_socio_puede_crear_lote(self, socio_client, socio_user, tenant):
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        hembra1 = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")
        hembra2 = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")

        resp = socio_client.post("/api/v1/lotes/", {
            "nombre": "Lote Primavera 2024",
            "macho": str(macho.id),
            "hembras": [str(hembra1.id), str(hembra2.id)],
            "fecha_inicio": "2024-03-01",
        }, format="json")

        assert resp.status_code == 201, resp.data
        assert resp.data["nombre"] == "Lote Primavera 2024"
        assert resp.data["macho_anilla"] == macho.numero_anilla
        assert len(resp.data["hembras_anillas"]) == 2
        assert hembra1.numero_anilla in resp.data["hembras_anillas"]
        assert hembra2.numero_anilla in resp.data["hembras_anillas"]

    def test_lote_requiere_macho_macho(self, socio_client, socio_user, tenant):
        """Un animal hembra no puede ser el macho del lote."""
        hembra = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")

        resp = socio_client.post("/api/v1/lotes/", {
            "nombre": "Lote Inválido",
            "macho": str(hembra.id),
            "hembras": [],
            "fecha_inicio": "2024-03-01",
        }, format="json")

        assert resp.status_code == 400

    def test_lote_serializer_enriquecido(self, socio_client, socio_user, tenant):
        """GET /lotes/:id/ devuelve macho_anilla, hembras_anillas y crias_count."""
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        hembra = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)
        lote.hembras.add(hembra)

        resp = socio_client.get(f"/api/v1/lotes/{lote.id}/")

        assert resp.status_code == 200, resp.data
        assert resp.data["macho_anilla"] == macho.numero_anilla
        assert hembra.numero_anilla in resp.data["hembras_anillas"]
        assert "crias_count" in resp.data
        assert resp.data["crias_count"] == 0

    def test_crias_count_correcto(self, socio_client, socio_user, tenant):
        """crias_count refleja el número de animales con madre_lote apuntando al lote."""
        from apps.animals.models import Animal
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)
        AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H", madre_lote=lote)
        AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H", madre_lote=lote)

        resp = socio_client.get(f"/api/v1/lotes/{lote.id}/")

        assert resp.status_code == 200, resp.data
        assert resp.data["crias_count"] == 2

    def test_lote_hembras_endpoint(self, socio_client, socio_user, tenant):
        """GET /lotes/:id/hembras/ devuelve lista enriquecida de hembras."""
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")
        hembra = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant, macho=macho)
        lote.hembras.add(hembra)

        resp = socio_client.get(f"/api/v1/lotes/{lote.id}/hembras/")

        assert resp.status_code == 200, resp.data
        assert len(resp.data) == 1
        assert resp.data[0]["numero_anilla"] == hembra.numero_anilla
        assert resp.data[0]["anio_nacimiento"] == hembra.anio_nacimiento
        assert "socio_nombre" in resp.data[0]

    def test_gestion_puede_crear_lote_para_cualquier_socio(
        self, gestion_client, socio_user, tenant
    ):
        """Gestión puede crear lotes especificando el socio propietario."""
        macho = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="M")

        resp = gestion_client.post("/api/v1/lotes/", {
            "nombre": "Lote Gestión",
            "macho": str(macho.id),
            "hembras": [],
            "fecha_inicio": "2024-03-01",
            "socio": str(socio_user.socio.id),
        }, format="json")

        assert resp.status_code == 201, resp.data
        assert resp.data["nombre"] == "Lote Gestión"
