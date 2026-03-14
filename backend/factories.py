"""
Factory Boy factories for AGAMUR test data.
Usage:
    from factories import AnimalFactory, SocioFactory
    animal = AnimalFactory(socio=some_socio)
"""
import factory
from factory.django import DjangoModelFactory

from apps.tenants.models import Tenant
from apps.accounts.models import User, Socio
from apps.animals.models import Animal
from apps.lotes.models import Lote


class TenantFactory(DjangoModelFactory):
    class Meta:
        model = Tenant
        django_get_or_create = ("slug",)

    name = factory.Sequence(lambda n: f"Asociación Test {n}")
    slug = factory.Sequence(lambda n: f"asoc-test-{n}")
    is_active = True
    primary_color = "#1565C0"
    secondary_color = "#FBC02D"


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    email = factory.Sequence(lambda n: f"user{n}@test.agamur.es")
    tenant = factory.SubFactory(TenantFactory)
    first_name = factory.Faker("first_name", locale="es_ES")
    last_name = factory.Faker("last_name", locale="es_ES")
    is_gestion = False
    is_active = True

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):
        obj.set_password(extracted or "testpass123!")
        if create:
            obj.save()


class SocioFactory(DjangoModelFactory):
    class Meta:
        model = Socio

    tenant = factory.LazyAttribute(lambda o: o.user.tenant)
    user = factory.SubFactory(UserFactory)
    nombre_razon_social = factory.Faker("company", locale="es_ES")
    # dni_nif: must be unique per tenant; use a valid DNI format (checksum enforced by serializer, not model)
    dni_nif = factory.Sequence(lambda n: f"{n:08d}T")  # T = remainder 0 mod 23
    numero_socio = factory.Sequence(lambda n: f"{n:05d}")
    codigo_rega = factory.Sequence(lambda n: f"ES{n:012d}")
    estado = Socio.Estado.ALTA


class AnimalFactory(DjangoModelFactory):
    class Meta:
        model = Animal

    tenant = factory.LazyAttribute(lambda o: o.socio.tenant)
    socio = factory.SubFactory(SocioFactory)
    numero_anilla = factory.Sequence(lambda n: f"TEST-{n:05d}")
    anio_nacimiento = 2024
    sexo = Animal.Sexo.MACHO
    variedad = Animal.Variedad.SALMON
    estado = Animal.Estado.AÑADIDO
    fotos = []
    historico_pesos = []
    alerta_anilla = ""


class LoteFactory(DjangoModelFactory):
    class Meta:
        model = Lote

    tenant = factory.LazyAttribute(lambda o: o.socio.tenant)
    socio = factory.SubFactory(SocioFactory)
    nombre = factory.Sequence(lambda n: f"Lote {n}")
    fecha_inicio = "2024-01-01"
    is_closed = False
