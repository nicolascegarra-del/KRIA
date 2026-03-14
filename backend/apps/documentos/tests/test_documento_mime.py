"""
Sprint 6 — Tests de validación MIME y límite de tamaño.

Cubre:
  - Subir PDF válido (magic bytes %PDF) → 201.
  - Subir JPEG válido → 201.
  - Subir PNG válido → 201.
  - Subir archivo con extensión .pdf pero contenido malicioso → 400.
  - Subir archivo .exe disfrazado → 400.
  - Archivo mayor de 20 MB → 400.
"""
import pytest
from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile


UPLOAD_URL = "/api/v1/documentos/general/upload/"


@pytest.mark.django_db
class TestDocumentoMime:

    def test_pdf_valido_201(self, gestion_client, tenant):
        """PDF con magic bytes correctos → 201."""
        with patch("apps.documentos.views.upload_bytes", return_value="key/ok.pdf"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp = gestion_client.post(
                UPLOAD_URL,
                {"file": SimpleUploadedFile("real.pdf", b"%PDF-1.4 real content", content_type="application/pdf")},
                format="multipart",
            )
        assert resp.status_code == 201

    def test_jpeg_valido_201(self, gestion_client, tenant):
        """JPEG con magic bytes correctos → 201."""
        jpeg_magic = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        with patch("apps.documentos.views.upload_bytes", return_value="key/ok.jpg"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp = gestion_client.post(
                UPLOAD_URL,
                {"file": SimpleUploadedFile("foto.jpg", jpeg_magic, content_type="image/jpeg")},
                format="multipart",
            )
        assert resp.status_code == 201

    def test_png_valido_201(self, gestion_client, tenant):
        """PNG con magic bytes correctos → 201."""
        png_magic = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        with patch("apps.documentos.views.upload_bytes", return_value="key/ok.png"), \
             patch("apps.reports.storage.get_presigned_download_url", return_value="http://fake"):
            resp = gestion_client.post(
                UPLOAD_URL,
                {"file": SimpleUploadedFile("img.png", png_magic, content_type="image/png")},
                format="multipart",
            )
        assert resp.status_code == 201

    def test_contenido_malicioso_con_extension_pdf_400(self, gestion_client, tenant):
        """Archivo con extensión .pdf pero contenido ejecutable → 400."""
        fake_content = b'MZ\x90\x00this is an exe disguised as pdf'
        resp = gestion_client.post(
            UPLOAD_URL,
            {"file": SimpleUploadedFile("virus.pdf", fake_content, content_type="application/pdf")},
            format="multipart",
        )
        assert resp.status_code == 400
        assert "no permitido" in resp.data["detail"].lower()

    def test_contenido_texto_plano_400(self, gestion_client, tenant):
        """Archivo de texto plano → 400."""
        resp = gestion_client.post(
            UPLOAD_URL,
            {"file": SimpleUploadedFile("nota.txt", b"hello world plain text", content_type="text/plain")},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_archivo_demasiado_grande_400(self, gestion_client, tenant):
        """Archivo mayor de 20MB → 400."""
        from unittest.mock import patch as _patch
        from django.core.files.uploadedfile import SimpleUploadedFile
        # Patching MAX_SIZE_BYTES to a small value avoids sending actual 20MB in tests.
        # The error message still mentions "20 MB" (hardcoded), which the assertion checks.
        small_content = b"%PDF-1.4" + b"x" * 50  # 58 bytes, > patched limit of 10
        with _patch("apps.documentos.views.MAX_SIZE_BYTES", 10):
            resp = gestion_client.post(
                UPLOAD_URL,
                {"file": SimpleUploadedFile("big.pdf", small_content, content_type="application/pdf")},
                format="multipart",
            )
        assert resp.status_code == 400
        assert "20" in resp.data["detail"]
