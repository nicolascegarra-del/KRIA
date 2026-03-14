"""
Sprint 3 — Tests de Evaluación morfológica completa.

Cubre:
  - Guardar evaluación con todos los campos obligatorios (6 scores) → 201, media calculada.
  - Guardar evaluación sin un campo de puntuación → 400.
  - Los 5 campos de observación son opcionales pero se persisten correctamente.
  - Al guardar evaluación, animal.estado pasa a EVALUADO (via signal).
  - variedad_confirmada en evaluación → se copia al animal (via signal).
"""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)
)))))

from factories import AnimalFactory, SocioFactory


EVAL_URL = "/api/v1/evaluaciones/"

BASE_SCORES = {
    "cabeza": 7,
    "cola": 8,
    "pecho_abdomen": 6,
    "muslos_tarsos": 9,
    "cresta_babilla": 7,
    "color": 8,
}


@pytest.mark.django_db
class TestEvaluacionFields:

    def test_crear_evaluacion_completa_201(self, gestion_client, tenant, socio_user):
        """Evaluación con los 6 campos → 201 y media calculada."""
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            estado="APROBADO",
            variedad="SALMON",
        )
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        data = resp.data
        # Media = (7+8+6+9+7+8)/6 = 45/6 = 7.50
        assert float(data["puntuacion_media"]) == pytest.approx(7.50, abs=0.01)
        assert str(data["animal"]) == str(animal.id)

    def test_crear_evaluacion_sin_campo_400(self, gestion_client, tenant, socio_user):
        """Falta un campo de puntuación → 400."""
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio, estado="APROBADO")
        payload = {k: v for k, v in BASE_SCORES.items() if k != "cola"}
        payload["animal"] = str(animal.id)
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 400
        assert "cola" in resp.data

    def test_crear_evaluacion_puntuacion_fuera_rango_400(self, gestion_client, tenant, socio_user):
        """Puntuación fuera de 1–10 → 400."""
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio, estado="APROBADO")
        payload = {**BASE_SCORES, "animal": str(animal.id), "cabeza": 11}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 400

    def test_campos_observacion_se_persisten(self, gestion_client, tenant, socio_user):
        """Los 5 campos de observación opcionales se guardan correctamente."""
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio, estado="APROBADO")
        payload = {
            **BASE_SCORES,
            "animal": str(animal.id),
            "picos_cresta": "Cresta serrada",
            "color_orejilla": "Blanca",
            "color_general": "Gris plateado",
            "peso_evaluacion": "3.45",
            "variedad_confirmada": "PLATA",
        }
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        data = resp.data
        assert data["picos_cresta"] == "Cresta serrada"
        assert data["color_orejilla"] == "Blanca"
        assert data["color_general"] == "Gris plateado"
        assert float(data["peso_evaluacion"]) == pytest.approx(3.45, abs=0.01)
        assert data["variedad_confirmada"] == "PLATA"

    def test_signal_estado_evaluado(self, gestion_client, tenant, socio_user):
        """Tras guardar evaluación, animal.estado pasa a EVALUADO."""
        from apps.animals.models import Animal
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio, estado="APROBADO")
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        animal.refresh_from_db()
        assert animal.estado == Animal.Estado.EVALUADO

    def test_signal_variedad_confirmada_copia_al_animal(self, gestion_client, tenant, socio_user):
        """variedad_confirmada en evaluación → se copia al campo variedad del animal."""
        from apps.animals.models import Animal
        animal = AnimalFactory(
            tenant=tenant,
            socio=socio_user.socio,
            estado="APROBADO",
            variedad="SALMON",
        )
        payload = {**BASE_SCORES, "animal": str(animal.id), "variedad_confirmada": "PLATA"}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 201, resp.data
        animal.refresh_from_db()
        assert animal.variedad == "PLATA"

    def test_evaluacion_cross_tenant_bloqueada(self, gestion_client, tenant):
        """No se puede evaluar un animal de otro tenant."""
        from factories import TenantFactory, AnimalFactory as AF
        otro_tenant = TenantFactory()
        socio_otro = SocioFactory(tenant=otro_tenant, user__tenant=otro_tenant)
        animal_otro = AF(tenant=otro_tenant, socio=socio_otro)
        payload = {**BASE_SCORES, "animal": str(animal_otro.id)}
        resp = gestion_client.post(EVAL_URL, payload, format="json")
        # Debe devolver 400 (animal no en este tenant) o 403
        assert resp.status_code in (400, 403)

    def test_solo_gestion_puede_evaluar(self, socio_client, tenant, socio_user):
        """Un socio no puede crear evaluaciones."""
        animal = AnimalFactory(tenant=tenant, socio=socio_user.socio, estado="APROBADO")
        payload = {**BASE_SCORES, "animal": str(animal.id)}
        resp = socio_client.post(EVAL_URL, payload, format="json")
        assert resp.status_code == 403
