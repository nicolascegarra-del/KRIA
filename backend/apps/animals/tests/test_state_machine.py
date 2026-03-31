"""
Tests for the animal state machine (semáforos).

Covers:
  - Socio edit on APROBADO/EVALUADO reverts to REGISTRADO (signal)
  - Gestión edit does NOT revert state
  - Evaluación guardada → estado EVALUADO automáticamente
  - UID anilla+año único por tenant, pero puede repetirse cross-tenant
  - madre_animal y madre_lote mutuamente excluyentes
"""
import pytest
from django.core.exceptions import ValidationError
from decimal import Decimal

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..', '..'))


@pytest.mark.django_db
class TestSemaforoAnimales:

    def test_socio_edit_aprobado_reverts_to_añadido(self, socio_user, tenant):
        """Al editar animal APROBADO como socio, debe volver a REGISTRADO."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="APROBADO")

        animal._editing_user = socio_user
        animal.variedad = "PLATA"
        animal.save()

        animal.refresh_from_db()
        assert animal.estado == "REGISTRADO"

    def test_socio_edit_evaluado_reverts_to_añadido(self, socio_user, tenant):
        """Al editar animal EVALUADO como socio, debe volver a REGISTRADO."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="EVALUADO")

        animal._editing_user = socio_user
        animal.variedad = "PLATA"
        animal.save()

        animal.refresh_from_db()
        assert animal.estado == "REGISTRADO"

    def test_gestion_edit_aprobado_stays_aprobado(self, gestion_user, socio_user, tenant):
        """Gestión puede editar animal APROBADO sin revertir el estado."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="APROBADO")

        animal._editing_user = gestion_user
        animal.variedad = "PLATA"
        animal.save()

        animal.refresh_from_db()
        assert animal.estado == "APROBADO"

    def test_socio_edit_añadido_stays_añadido(self, socio_user, tenant):
        """Editar animal ya en REGISTRADO no cambia el estado."""
        from factories import AnimalFactory
        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="REGISTRADO")

        animal._editing_user = socio_user
        animal.variedad = "PLATA"
        animal.save()

        animal.refresh_from_db()
        assert animal.estado == "REGISTRADO"

    def test_evaluacion_auto_cambia_a_evaluado(self, gestion_user, socio_user, tenant):
        """Crear una evaluación debe mover el animal a estado EVALUADO (signal)."""
        from factories import AnimalFactory
        from apps.evaluaciones.models import Evaluacion

        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="APROBADO")

        Evaluacion.objects.create(
            tenant=tenant,
            animal=animal,
            evaluador=gestion_user,
            cabeza=7, cola=8, pecho_abdomen=7,
            muslos_tarsos=8, cresta_babilla=7, color=8,
        )

        animal.refresh_from_db()
        assert animal.estado == "EVALUADO"

    def test_evaluacion_media_calcula_correctamente(self, gestion_user, socio_user, tenant):
        """La media aritmética de los 6 campos se calcula automáticamente al guardar."""
        from factories import AnimalFactory
        from apps.evaluaciones.models import Evaluacion

        animal = AnimalFactory(socio=socio_user.socio, tenant=tenant, estado="APROBADO")
        ev = Evaluacion.objects.create(
            tenant=tenant, animal=animal, evaluador=gestion_user,
            cabeza=8, cola=6, pecho_abdomen=7,
            muslos_tarsos=9, cresta_babilla=5, color=7,
        )
        # (8+6+7+9+5+7) / 6 = 42/6 = 7.00
        assert ev.puntuacion_media == Decimal("7.00")

    def test_uid_anilla_anio_unico_por_tenant(self, socio_user, tenant):
        """Anilla+año duplicada dentro del mismo tenant → IntegrityError."""
        from django.db import IntegrityError
        from factories import AnimalFactory

        AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            numero_anilla="ES-DUP-001", anio_nacimiento=2024
        )
        with pytest.raises(IntegrityError):
            AnimalFactory(
                socio=socio_user.socio, tenant=tenant,
                numero_anilla="ES-DUP-001", anio_nacimiento=2024
            )

    def test_uid_anilla_distinto_anio_permitido(self, socio_user, tenant):
        """Misma anilla pero distinto año SÍ está permitida."""
        from factories import AnimalFactory

        a1 = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            numero_anilla="ES-DIST-001", anio_nacimiento=2023
        )
        a2 = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            numero_anilla="ES-DIST-001", anio_nacimiento=2024
        )
        assert a1.pk != a2.pk

    def test_uid_anilla_cross_tenant_permitido(self, tenant):
        """La misma anilla+año puede existir en dos tenants diferentes."""
        from factories import TenantFactory, SocioFactory, UserFactory, AnimalFactory

        tenant_b = TenantFactory(slug="otro-tenant")
        user_b = UserFactory(tenant=tenant_b)
        socio_b = SocioFactory(user=user_b, tenant=tenant_b)

        a1 = AnimalFactory(tenant=tenant, numero_anilla="ES-CT-001", anio_nacimiento=2024)
        a2 = AnimalFactory(tenant=tenant_b, socio=socio_b, numero_anilla="ES-CT-001", anio_nacimiento=2024)
        assert a1.pk != a2.pk

    def test_madre_animal_y_madre_lote_mutuamente_excluyentes(self, socio_user, tenant):
        """madre_animal y madre_lote son mutuamente excluyentes (clean() lo valida)."""
        from factories import AnimalFactory, LoteFactory

        madre = AnimalFactory(socio=socio_user.socio, tenant=tenant, sexo="H")
        lote = LoteFactory(socio=socio_user.socio, tenant=tenant)

        animal = AnimalFactory(
            socio=socio_user.socio, tenant=tenant,
            madre_animal=madre, madre_lote=lote
        )
        with pytest.raises(ValidationError):
            animal.clean()
