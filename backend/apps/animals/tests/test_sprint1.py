"""
Sprint 1 — Tests para el módulo Animal.

Covers:
  - Campos nuevos: fecha_incubacion, ganaderia_nacimiento, ganaderia_actual
  - Fotos tipadas (PERFIL / CABEZA / ANILLA)
  - Validación 3 fotos antes de aprobar
  - Endpoint de pesajes
  - Búsqueda padre/madre por anilla+año
  - Bloqueo de variedad tras evaluación (socios)
"""
import unittest.mock as mock
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile


# ─── helpers ──────────────────────────────────────────────────────────────────

def _fake_jpeg():
    """Minimal valid JPEG bytes (magic header)."""
    return bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"\x00" * 20


def _upload_foto(client, animal_id, tipo, content=None):
    data = {
        "tipo": tipo,
        "foto": SimpleUploadedFile("foto.jpg", content or _fake_jpeg(), content_type="image/jpeg"),
    }
    with mock.patch("apps.reports.storage.upload_bytes", return_value=None), \
         mock.patch("apps.animals.views._optimize_image", side_effect=lambda b, **kw: b), \
         mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
        return client.post(f"/api/v1/animals/{animal_id}/foto/", data, format="multipart")


# ─── Nuevos campos ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestNuevosCamposAnimal:

    def test_crear_animal_con_campos_nuevos(self, socio_client, tenant):
        resp = socio_client.post("/api/v1/animals/", {
            "numero_anilla": "ES-S1-001",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "fecha_incubacion": "2024-03-15",
            "ganaderia_nacimiento": "Granja Origen",
            "ganaderia_actual": "Granja Actual",
        })
        assert resp.status_code == 201, resp.data
        assert resp.data["fecha_incubacion"] == "2024-03-15"
        assert resp.data["ganaderia_nacimiento"] == "Granja Origen"
        assert resp.data["ganaderia_actual"] == "Granja Actual"

    def test_campos_nuevos_opcionales(self, socio_client, tenant):
        """fecha_incubacion y ganaderías son opcionales."""
        resp = socio_client.post("/api/v1/animals/", {
            "numero_anilla": "ES-S1-002",
            "anio_nacimiento": 2024,
            "sexo": "H",
            "variedad": "PLATA",
        })
        assert resp.status_code == 201, resp.data
        assert resp.data["fecha_incubacion"] is None
        assert resp.data["ganaderia_nacimiento"] == ""


# ─── Fotos tipadas ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFotosTipadas:

    def test_upload_foto_con_tipo_valido(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        resp = _upload_foto(socio_client, animal.id, "PERFIL")
        assert resp.status_code == 201, resp.data
        fotos = resp.data["fotos"]
        assert len(fotos) == 1
        assert fotos[0]["tipo"] == "PERFIL"

    def test_upload_foto_tipo_invalido_rechazado(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        data = {"tipo": "INVALID", "foto": SimpleUploadedFile("foto.jpg", _fake_jpeg(), content_type="image/jpeg")}
        resp = socio_client.post(f"/api/v1/animals/{animal.id}/foto/", data, format="multipart")
        assert resp.status_code == 400

    def test_upload_foto_sin_tipo_rechazado(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        data = {"foto": SimpleUploadedFile("foto.jpg", _fake_jpeg(), content_type="image/jpeg")}
        resp = socio_client.post(f"/api/v1/animals/{animal.id}/foto/", data, format="multipart")
        assert resp.status_code == 400

    def test_foto_reemplaza_mismo_tipo(self, socio_client, socio_user, tenant):
        """Subir 2 fotos PERFIL: la segunda reemplaza a la primera."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        _upload_foto(socio_client, animal.id, "PERFIL")
        resp = _upload_foto(socio_client, animal.id, "PERFIL")

        assert resp.status_code == 201
        tipos = [f["tipo"] for f in resp.data["fotos"]]
        assert tipos.count("PERFIL") == 1  # solo una PERFIL

    def test_tres_tipos_distintos_coexisten(self, socio_client, socio_user, tenant):
        """PERFIL + CABEZA + ANILLA deben coexistir."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        _upload_foto(socio_client, animal.id, "PERFIL")
        _upload_foto(socio_client, animal.id, "CABEZA")
        resp = _upload_foto(socio_client, animal.id, "ANILLA")

        assert resp.status_code == 201
        tipos = {f["tipo"] for f in resp.data["fotos"]}
        assert tipos == {"PERFIL", "CABEZA", "ANILLA"}


# ─── Validación 3 fotos antes de aprobar ──────────────────────────────────────

@pytest.mark.django_db
class TestAprobacionConFotos:

    def test_aprobar_sin_fotos_da_400(self, gestion_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="AÑADIDO")

        resp = gestion_client.post(f"/api/v1/animals/{animal.id}/approve/")
        assert resp.status_code == 400
        assert "falt" in resp.data["detail"].lower()

    def test_aprobar_con_2_fotos_da_400(self, gestion_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, estado="AÑADIDO",
            fotos=[
                {"tipo": "PERFIL", "key": "k1", "uploaded_at": "2024-01-01"},
                {"tipo": "CABEZA", "key": "k2", "uploaded_at": "2024-01-01"},
            ]
        )
        resp = gestion_client.post(f"/api/v1/animals/{animal.id}/approve/")
        assert resp.status_code == 400
        assert "anilla" in resp.data["detail"].lower()

    def test_aprobar_con_3_fotos_tipadas_ok(self, gestion_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant, estado="AÑADIDO",
            fotos=[
                {"tipo": "PERFIL", "key": "k1", "uploaded_at": "2024-01-01"},
                {"tipo": "CABEZA", "key": "k2", "uploaded_at": "2024-01-01"},
                {"tipo": "ANILLA", "key": "k3", "uploaded_at": "2024-01-01"},
            ]
        )
        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = gestion_client.post(f"/api/v1/animals/{animal.id}/approve/")
        assert resp.status_code == 200
        assert resp.data["estado"] == "APROBADO"


# ─── Endpoint de pesajes ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPesajes:

    def test_socio_puede_registrar_pesaje(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = socio_client.post(f"/api/v1/animals/{animal.id}/pesaje/", {
                "fecha": "2024-06-01",
                "peso": "4.5",
            })
        assert resp.status_code == 201, resp.data
        pesos = resp.data["historico_pesos"]
        assert len(pesos) == 1
        assert pesos[0]["fecha"] == "2024-06-01"
        assert pesos[0]["peso"] == 4.5

    def test_pesaje_acumula_entradas(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            socio_client.post(f"/api/v1/animals/{animal.id}/pesaje/", {"fecha": "2024-01-01", "peso": "3.0"})
            resp = socio_client.post(f"/api/v1/animals/{animal.id}/pesaje/", {"fecha": "2024-06-01", "peso": "4.5"})

        assert len(resp.data["historico_pesos"]) == 2

    def test_pesaje_sin_fecha_da_400(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        resp = socio_client.post(f"/api/v1/animals/{animal.id}/pesaje/", {"peso": "4.5"})
        assert resp.status_code == 400

    def test_socio_no_puede_pesar_animal_de_otro(self, socio_client_b, socio_user, tenant):
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant)

        resp = socio_client_b.post(f"/api/v1/animals/{animal.id}/pesaje/", {
            "fecha": "2024-06-01",
            "peso": "4.5",
        })
        assert resp.status_code == 403


# ─── Búsqueda padre/madre por anilla ──────────────────────────────────────────

@pytest.mark.django_db
class TestGenealogiaByAnilla:

    def test_crear_animal_con_padre_por_anilla(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        padre = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            numero_anilla="ES-PADRE-001", anio_nacimiento=2020, sexo="M"
        )

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = socio_client.post("/api/v1/animals/", {
                "numero_anilla": "ES-HIJO-001",
                "anio_nacimiento": 2024,
                "sexo": "M",
                "variedad": "SALMON",
                "padre_anilla": "ES-PADRE-001",
                "padre_anio": 2020,
            })
        assert resp.status_code == 201, resp.data
        assert str(resp.data["padre"]) == str(padre.id)

    def test_padre_anilla_no_encontrada_da_400(self, socio_client, tenant):
        resp = socio_client.post("/api/v1/animals/", {
            "numero_anilla": "ES-HIJO-002",
            "anio_nacimiento": 2024,
            "sexo": "M",
            "variedad": "SALMON",
            "padre_anilla": "ES-NOEXISTE",
            "padre_anio": 2020,
        })
        assert resp.status_code == 400

    def test_madre_por_anilla_resuelve_correctamente(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        madre = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            numero_anilla="ES-MADRE-001", anio_nacimiento=2019, sexo="H"
        )

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = socio_client.post("/api/v1/animals/", {
                "numero_anilla": "ES-CRIA-001",
                "anio_nacimiento": 2024,
                "sexo": "H",
                "variedad": "SALMON",
                "madre_anilla": "ES-MADRE-001",
                "madre_anio": 2019,
            })
        assert resp.status_code == 201, resp.data
        assert str(resp.data["madre_animal"]) == str(madre.id)


# ─── Bloqueo de variedad tras evaluación ──────────────────────────────────────

@pytest.mark.django_db
class TestBloqueoVariedad:

    def _crear_evaluacion(self, animal, tenant):
        from apps.evaluaciones.models import Evaluacion
        from apps.accounts.models import User
        gestion_user = User.objects.get(email="admin@agamur.es", tenant=tenant)
        return Evaluacion.objects.create(
            tenant=tenant, animal=animal, evaluador=gestion_user,
            cabeza=7, cola=7, pecho_abdomen=7,
            muslos_tarsos=7, cresta_babilla=7, color=7,
        )

    def test_socio_no_puede_cambiar_variedad_con_evaluacion(
        self, socio_client, gestion_user, socio_user, tenant
    ):
        from factories import AnimalFactory
        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            estado="EVALUADO", variedad="SALMON"
        )
        self._crear_evaluacion(animal, tenant)

        resp = socio_client.patch(f"/api/v1/animals/{animal.id}/", {"variedad": "PLATA"})
        assert resp.status_code == 400
        assert "variedad" in str(resp.data).lower()

    def test_socio_puede_cambiar_variedad_sin_evaluacion(self, socio_client, socio_user, tenant):
        from factories import AnimalFactory
        import unittest.mock as mock
        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            estado="AÑADIDO", variedad="SALMON"
        )

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = socio_client.patch(f"/api/v1/animals/{animal.id}/", {"variedad": "PLATA"})
        # No debe dar 400 por variedad
        assert resp.status_code != 400

    def test_gestion_puede_cambiar_variedad_con_evaluacion(
        self, gestion_client, gestion_user, socio_user, tenant
    ):
        from factories import AnimalFactory
        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            estado="EVALUADO", variedad="SALMON"
        )
        self._crear_evaluacion(animal, tenant)

        with mock.patch("apps.reports.storage.get_presigned_download_url", return_value="http://minio/test.jpg"):
            resp = gestion_client.patch(f"/api/v1/animals/{animal.id}/", {"variedad": "PLATA"})
        # Gestión puede cambiar — no debe dar 400 por variedad
        assert "variedad" not in str(resp.data).lower() or resp.status_code == 200
