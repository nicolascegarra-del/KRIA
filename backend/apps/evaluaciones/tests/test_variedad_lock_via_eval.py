"""
Sprint 3 — Tests de sincronización de variedad vía evaluación.

Cubre:
  - variedad_confirmada en evaluación copia la variedad al animal (signal).
  - Si variedad_confirmada es null, la variedad del animal no cambia.
  - Al actualizar la evaluación con nueva variedad_confirmada → animal actualiza su variedad.
  - Socio no puede cambiar variedad si ya existe evaluación (lock previo de Sprint 1).
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory


EVAL_URL = "/api/v1/evaluaciones/"
ANIMALS_URL = "/api/v1/animals/"

BASE_SCORES = {
    "cabeza": 7,
    "cola": 8,
    "pecho_abdomen": 6,
    "muslos_tarsos": 9,
    "cresta_babilla": 7,
    "color": 8,
}


@pytest.mark.django_db
class TestVariedadLockViaEval:

    def test_variedad_confirmada_copia_salmon(self, gestion_client, tenant, socio_user):
        """variedad_confirmada='SALMON' → animal.variedad='SALMON'."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            estado="APROBADO", variedad="OTRA"
        )
        payload = {**BASE_SCORES, "animal": str(animal.id), "variedad_confirmada": "SALMON"}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        animal.refresh_from_db()
        assert animal.variedad == "SALMON"

    def test_variedad_confirmada_null_no_modifica_animal(self, gestion_client, tenant, socio_user):
        """Sin variedad_confirmada, la variedad del animal no cambia."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            estado="APROBADO", variedad="PLATA"
        )
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        animal.refresh_from_db()
        assert animal.variedad == "PLATA"  # sin cambios

    def test_variedad_misma_no_produce_error(self, gestion_client, tenant, socio_user):
        """variedad_confirmada igual a la actual del animal → no falla, no produce doble save."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            estado="APROBADO", variedad="SALMON"
        )
        payload = {**BASE_SCORES, "animal": str(animal.id), "variedad_confirmada": "SALMON"}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        animal.refresh_from_db()
        assert animal.variedad == "SALMON"

    def test_actualizar_evaluacion_actualiza_variedad(self, gestion_client, tenant, socio_user):
        """Actualizar variedad_confirmada en PATCH → variedad del animal se actualiza."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            estado="APROBADO", variedad="SALMON"
        )
        # Crear evaluación inicial sin variedad_confirmada
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        eval_id = resp.data["id"]

        # PATCH con variedad_confirmada
        resp2 = gestion_client.patch(
            f"{EVAL_URL}{eval_id}/",
            {"variedad_confirmada": "PLATA"},
            format="json",
        )
        assert resp2.status_code == 200, resp2.data
        animal.refresh_from_db()
        assert animal.variedad == "PLATA"

    def test_socio_no_puede_cambiar_variedad_tras_evaluacion(
        self, gestion_client, socio_client, tenant, socio_user
    ):
        """Socio no puede cambiar variedad si ya existe evaluación (lock previo Sprint 1)."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant, socio=socio_user.socio,
            estado="APROBADO", variedad="SALMON",
            fotos=[
                {"tipo": "PERFIL", "key": "k1", "uploaded_at": "2024-01-01T00:00:00+00:00"},
                {"tipo": "CABEZA", "key": "k2", "uploaded_at": "2024-01-01T00:00:00+00:00"},
                {"tipo": "ANILLA", "key": "k3", "uploaded_at": "2024-01-01T00:00:00+00:00"},
            ],
        )
        # Crear evaluación
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data

        # Socio intenta cambiar variedad → debe devolver 400
        resp2 = socio_client.patch(
            f"{ANIMALS_URL}{animal.id}/",
            {"variedad": "PLATA"},
            format="json",
        )
        assert resp2.status_code == 400
        assert "variedad" in str(resp2.data).lower()
