"""
Sprint 6 — Tests del repositorio general (solo Gestión).

Cubre:
  - Gestión puede subir documento general.
  - Gestión puede listar documentos generales.
  - Gestión puede subir documento al buzón de un socio.
  - Gestión puede eliminar un documento (204).
  - Versionado: subir mismo nombre_archivo → version se incrementa.
  - Socio no puede subir documentos (solo descarga).
"""
import pytest
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile


GENERAL_LIST_URL = "/api/v1/documentos/general/"
GENERAL_UPLOAD_URL = "/api/v1/documentos/general/upload/"


def _pdf_file(name="informe.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")


@pytest.mark.django_db
class TestDocumentoGestionOnly:

    def test_gestion_sube_documento_general(self, gestion_client, tenant):
        """Gestión puede subir un documento al repositorio general."""
        content = _pdf_file()
        with patch("apps.documentos.views.upload_bytes", return_value="key/doc.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp = gestion_client.post(
                GENERAL_UPLOAD_URL,
                {"file": content},
                format="multipart",
            )
        assert resp.status_code == 201, resp.data
        assert resp.data["tipo"] == "GENERAL"
        assert resp.data["nombre_archivo"] == "informe.pdf"
        assert resp.data["version"] == 1

    def test_gestion_lista_documentos_generales(self, gestion_client, tenant):
        """Gestión puede listar el repositorio general."""
        resp = gestion_client.get(GENERAL_LIST_URL)
        assert resp.status_code == 200

    def test_gestion_sube_a_buzon_socio(self, gestion_client, tenant, socio_user):
        """Gestión puede subir documento al buzón de un socio específico."""
        socio_id = socio_user.socio.id
        content = _pdf_file("carta.pdf")
        with patch("apps.documentos.views.upload_bytes", return_value="key/carta.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp = gestion_client.post(
                f"/api/v1/documentos/socios/{socio_id}/upload/",
                {"file": content},
                format="multipart",
            )
        assert resp.status_code == 201, resp.data
        assert resp.data["tipo"] == "PARTICULAR"
        assert str(resp.data["socio"]) == str(socio_id)

    def test_gestion_elimina_documento(self, gestion_client, tenant):
        """Gestión puede eliminar un documento → 204."""
        content = _pdf_file("borrar.pdf")
        with patch("apps.documentos.views.upload_bytes", return_value="key/borrar.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp_up = gestion_client.post(
                GENERAL_UPLOAD_URL,
                {"file": content},
                format="multipart",
            )
        assert resp_up.status_code == 201
        doc_id = resp_up.data["id"]

        with patch("apps.documentos.views.get_minio_client"):
            resp_del = gestion_client.delete(f"/api/v1/documentos/{doc_id}/")
        assert resp_del.status_code == 204

    def test_versionado_mismo_nombre(self, gestion_client, tenant):
        """Subir el mismo nombre_archivo dos veces → version 1 y 2."""
        with patch("apps.documentos.views.upload_bytes", return_value="key/v1.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            r1 = gestion_client.post(
                GENERAL_UPLOAD_URL,
                {"file": SimpleUploadedFile("norma.pdf", b"%PDF v1", content_type="application/pdf")},
                format="multipart",
            )
            r2 = gestion_client.post(
                GENERAL_UPLOAD_URL,
                {"file": SimpleUploadedFile("norma.pdf", b"%PDF v2", content_type="application/pdf")},
                format="multipart",
            )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.data["version"] == 1
        assert r2.data["version"] == 2

    def test_socio_no_puede_subir_documento_general(self, socio_client):
        """Socio recibe 403 al intentar subir al repositorio general."""
        content = _pdf_file()
        resp = socio_client.post(
            GENERAL_UPLOAD_URL,
            {"file": content},
            format="multipart",
        )
        assert resp.status_code == 403
