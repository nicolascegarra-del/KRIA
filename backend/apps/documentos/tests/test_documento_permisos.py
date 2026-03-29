"""
Sprint 6 — Tests de permisos del Gestor Documental.

Cubre:
  - Socio A no puede ver documentos del buzón de socio B → 403.
  - Socio puede ver su propio buzón particular.
  - Socio no puede ver repositorio general → (GET /documentos/general/ → 403).
  - Socio puede descargar su propio documento particular.
  - Socio no puede descargar documento particular ajeno → 403.
  - Socio no puede descargar documento general → 403.
"""
import pytest
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile

from factories import SocioFactory, UserFactory


GENERAL_URL = "/api/v1/documentos/general/"


def _make_pdf_file(name="test.pdf"):
    """Minimal valid PDF bytes (magic bytes only for test)."""
    return SimpleUploadedFile(name, b"%PDF-1.4 fake pdf content", content_type="application/pdf")


@pytest.mark.django_db
class TestDocumentoPermisos:

    def _upload_socio_doc(self, gestion_client, socio_id, filename="doc.pdf"):
        content = _make_pdf_file(filename)
        with patch("apps.documentos.views.upload_bytes", return_value="key/doc.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake/doc.pdf"):
            return gestion_client.post(
                f"/api/v1/documentos/socios/{socio_id}/upload/",
                {"file": content},
                format="multipart",
            )

    def test_socio_ve_su_propio_buzon(self, gestion_client, socio_client, tenant, socio_user):
        """Socio puede ver el listado de sus propios documentos."""
        self._upload_socio_doc(gestion_client, socio_user.socio.id)
        with patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake/url"):
            resp = socio_client.get(f"/api/v1/documentos/socios/{socio_user.socio.id}/")
        assert resp.status_code == 200

    def test_socio_a_no_puede_ver_buzon_socio_b(
        self, gestion_client, socio_client, socio_client_b, tenant, socio_user, socio_user_b
    ):
        """Socio A no puede ver el buzón del Socio B → 403."""
        resp = socio_client.get(f"/api/v1/documentos/socios/{socio_user_b.socio.id}/")
        assert resp.status_code == 403

    def test_socio_no_puede_ver_general(self, socio_client):
        """Socio obtiene 403 al intentar listar /documentos/general/."""
        resp = socio_client.get(GENERAL_URL)
        assert resp.status_code == 403

    def test_socio_descarga_propio_documento(self, gestion_client, socio_client, tenant, socio_user):
        """Socio puede obtener URL de descarga de su propio documento."""
        resp_upload = self._upload_socio_doc(gestion_client, socio_user.socio.id)
        assert resp_upload.status_code == 201, resp_upload.data
        doc_id = resp_upload.data["id"]

        with patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake/download"):
            resp = socio_client.get(f"/api/v1/documentos/{doc_id}/download/")
        assert resp.status_code == 200
        assert "download_url" in resp.data

    def test_socio_no_puede_descargar_documento_ajeno(
        self, gestion_client, socio_client, tenant, socio_user, socio_user_b
    ):
        """Socio A no puede descargar documento del buzón de Socio B → 403."""
        resp_upload = self._upload_socio_doc(gestion_client, socio_user_b.socio.id)
        assert resp_upload.status_code == 201, resp_upload.data
        doc_id = resp_upload.data["id"]

        with patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake/download"):
            resp = socio_client.get(f"/api/v1/documentos/{doc_id}/download/")
        assert resp.status_code == 403

    def test_socio_no_puede_descargar_documento_general(
        self, gestion_client, socio_client, tenant, socio_user
    ):
        """Socio no puede descargar documentos del repositorio general → 403."""
        content = _make_pdf_file("general.pdf")
        with patch("apps.documentos.views.upload_bytes", return_value="key/general.pdf"):
            resp_upload = gestion_client.post(
                "/api/v1/documentos/general/upload/",
                {"file": content},
                format="multipart",
            )
        assert resp_upload.status_code == 201, resp_upload.data
        doc_id = resp_upload.data["id"]

        with patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake/download"):
            resp = socio_client.get(f"/api/v1/documentos/{doc_id}/download/")
        assert resp.status_code == 403
