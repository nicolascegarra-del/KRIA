"""
Management command: seed_admin

Creates (or updates) the first superadmin user AND demo socio users
with linked Socio profiles, ready to test all app features.

Usage:
  python manage.py seed_admin
  python manage.py seed_admin --email admin@example.com --password secret123
  python manage.py seed_admin --tenant myassoc --tenant-name "Mi Asociación"
"""
from django.core.management.base import BaseCommand

from apps.tenants.models import Tenant
from apps.accounts.models import User, Socio


class Command(BaseCommand):
    help = "Seed initial superadmin + demo socio users and demo tenant with full demo data"

    def add_arguments(self, parser):
        parser.add_argument("--email", default="admin@kria.es")
        parser.add_argument("--password", default="kria2024!")
        parser.add_argument("--tenant", default="demo")
        parser.add_argument("--tenant-name", default="Asociación Demo KRIA")

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        slug = options["tenant"]
        tenant_name = options["tenant_name"]

        # ── 1. Tenant ──────────────────────────────────────────────────────────
        tenant, t_created = Tenant.objects.update_or_create(
            slug=slug,
            defaults={
                "name": tenant_name,
                "is_active": True,
                "primary_color": "#1565C0",
                "secondary_color": "#FBC02D",
                "max_socios": 50,
            },
        )
        action = "Created" if t_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} tenant: {tenant.name} (slug={tenant.slug})"
        ))

        # ── 2. Superadmin (gestión) ────────────────────────────────────────────
        # Los superadmins deben pertenecer al tenant "system" para que la
        # guardia IsSuperAdmin (tenant.slug == "system") funcione correctamente.
        system_tenant, _ = Tenant.objects.get_or_create(
            slug="system",
            defaults={"name": "System", "is_active": True, "max_socios": 0},
        )
        admin_user, u_created = User.objects.update_or_create(
            email=email,
            defaults={
                "tenant": system_tenant,
                "is_gestion": True,
                "is_superadmin": True,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "first_name": "Admin",
                "last_name": "KRIA",
            },
        )
        admin_user.set_password(password)
        admin_user.save()

        action = "Created" if u_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} superadmin: {email} (tenant={tenant.slug})"
        ))

        # ── 3. Socio 1: Granja Hidalgo S.L. ───────────────────────────────────
        socio_email = "socio@kria.es"
        socio_password = "kria2024!"

        socio_user1, su_created = User.objects.update_or_create(
            email=socio_email,
            defaults={
                "tenant": tenant,
                "is_gestion": False,
                "is_superadmin": False,
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
                "first_name": "Carlos",
                "last_name": "Hidalgo",
            },
        )
        socio_user1.set_password(socio_password)
        socio_user1.save()

        action = "Created" if su_created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{action} socio user: {socio_email}"))

        socio1, sp_created = Socio.all_objects.update_or_create(
            tenant=tenant,
            numero_socio="0001",
            defaults={
                "user": socio_user1,
                "nombre_razon_social": "Granja Hidalgo S.L.",
                "dni_nif": "12345678Z",
                "telefono": "612345678",
                "direccion": "Calle Mayor 1, 28001 Madrid",
                "codigo_rega": "ES280101000001",
                "estado": Socio.Estado.ALTA,
            },
        )
        action = "Created" if sp_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} socio profile: {socio1.nombre_razon_social} (nº {socio1.numero_socio})"
        ))

        # ── 4. Socios adicionales ──────────────────────────────────────────────
        socio_user2, _ = User.objects.update_or_create(
            email="socio2@kria.es",
            defaults={
                "tenant": tenant,
                "is_gestion": False,
                "is_active": True,
                "first_name": "Ana",
                "last_name": "Montaña",
            },
        )
        socio_user2.set_password("kria2024!")
        socio_user2.save()

        socio2, _ = Socio.all_objects.update_or_create(
            tenant=tenant,
            numero_socio="0002",
            defaults={
                "user": socio_user2,
                "nombre_razon_social": "Avícola Montaña S.C.",
                "dni_nif": "87654321B",
                "telefono": "623456789",
                "direccion": "Calle Sierra 5, 08001 Barcelona",
                "codigo_rega": "ES080201000045",
                "estado": Socio.Estado.ALTA,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Upserted socio: {socio2.nombre_razon_social}"))

        socio_user3, _ = User.objects.update_or_create(
            email="socio3@kria.es",
            defaults={
                "tenant": tenant,
                "is_gestion": False,
                "is_active": True,
                "first_name": "Pedro",
                "last_name": "Roca",
            },
        )
        socio_user3.set_password("kria2024!")
        socio_user3.save()

        socio3, _ = Socio.all_objects.update_or_create(
            tenant=tenant,
            numero_socio="0003",
            defaults={
                "user": socio_user3,
                "nombre_razon_social": "Explotación Roca Viva",
                "dni_nif": "11223344C",
                "telefono": "634567890",
                "direccion": "Camino Rural 12, 41001 Sevilla",
                "codigo_rega": "ES410301000010",
                "estado": Socio.Estado.ALTA,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Upserted socio: {socio3.nombre_razon_social}"))

        # ── 5. Granjas ─────────────────────────────────────────────────────────
        self._seed_granjas(tenant, socio1, socio2)

        # ── 6. Animales ────────────────────────────────────────────────────────
        self._seed_motivos_baja(tenant)
        animals = self._seed_animals(tenant, socio1, socio2, socio3)

        # ── 7. Evaluaciones ────────────────────────────────────────────────────
        self._seed_evaluaciones(tenant, admin_user, animals)

        # ── 8. Lotes de Cría ───────────────────────────────────────────────────
        self._seed_lotes(tenant, socio1, animals)

        # ── 9. Entregas de Anillas ─────────────────────────────────────────────
        self._seed_anillas(tenant, admin_user, socio1, socio2, socio3)

        # ── 10. Conflictos ─────────────────────────────────────────────────────
        self._seed_conflictos(tenant, socio1, socio2, animals)

        # ── 11. Solicitudes de Re-alta ─────────────────────────────────────────
        self._seed_realta(tenant, socio1, animals)

        # ── 12. Documentos ─────────────────────────────────────────────────────
        self._seed_documentos(tenant, admin_user, socio1)

        # ── Summary ───────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(self.style.WARNING("  KRIA — Usuarios de prueba creados"))
        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(f"  URL:             http://localhost:5173")
        self.stdout.write(f"  Tenant (código): {slug}")
        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("  👤 GESTIÓN (panel de administración):"))
        self.stdout.write(f"     Email:      {email}")
        self.stdout.write(f"     Contraseña: {password}")
        self.stdout.write(f"     Checkbox:   ✓ Acceder como equipo de Gestión")
        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO("  🐔 SOCIOS:"))
        self.stdout.write(f"     socio@kria.es   / kria2024!  — Granja Hidalgo S.L.")
        self.stdout.write(f"     socio2@kria.es  / kria2024!  — Avícola Montaña S.C.")
        self.stdout.write(f"     socio3@kria.es  / kria2024!  — Explotación Roca Viva")
        self.stdout.write(self.style.WARNING("=" * 60))

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _seed_granjas(self, tenant, socio1, socio2):
        from apps.granjas.models import Granja

        granjas = [
            {"socio": socio1, "nombre": "Can Hidalgo",       "codigo_rega": "ES280101000001"},
            {"socio": socio1, "nombre": "Nave 2 — Hidalgo",  "codigo_rega": ""},
            {"socio": socio2, "nombre": "Sierra Alta",        "codigo_rega": "ES080201000045"},
        ]
        for g in granjas:
            obj, created = Granja.all_objects.get_or_create(
                tenant=tenant,
                socio=g["socio"],
                nombre=g["nombre"],
                defaults={"codigo_rega": g["codigo_rega"]},
            )
            if created:
                self.stdout.write(f"  Created granja: {obj.nombre}")

    def _seed_motivos_baja(self, tenant):
        from apps.animals.models import MotivoBaja
        defaults = [
            ("Fallecimiento", 0),
            ("Venta", 1),
            ("Cesión", 2),
        ]
        for nombre, orden in defaults:
            MotivoBaja.all_objects.get_or_create(
                tenant=tenant,
                nombre=nombre,
                defaults={"orden": orden, "is_active": True},
            )
        self.stdout.write("  Motivos de baja creados.")

    def _seed_animals(self, tenant, socio1, socio2, socio3):
        import datetime
        from apps.animals.models import Animal

        fotos_demo = [
            {"tipo": "PERFIL", "key": "demo/perfil.jpg",  "url": "https://picsum.photos/seed/perfil/400/300"},
            {"tipo": "CABEZA", "key": "demo/cabeza.jpg",  "url": "https://picsum.photos/seed/cabeza/400/300"},
            {"tipo": "ANILLA", "key": "demo/anilla.jpg",  "url": "https://picsum.photos/seed/anilla/400/300"},
        ]

        specs = [
            # (numero_anilla, fecha, sexo, estado, candidato, aprobado, socio, fotos)
            ("ES-001-24", datetime.date(2024, 3, 15), Animal.Sexo.MACHO,   Animal.Estado.AÑADIDO,   False, False, socio1, []),
            ("ES-002-24", datetime.date(2024, 5, 20), Animal.Sexo.HEMBRA,  Animal.Estado.AÑADIDO,   False, False, socio1, []),
            ("ES-003-23", datetime.date(2023, 4, 10), Animal.Sexo.MACHO,   Animal.Estado.APROBADO,  True,  False, socio1, fotos_demo),
            ("ES-004-23", datetime.date(2023, 6, 1),  Animal.Sexo.HEMBRA,  Animal.Estado.EVALUADO,  True,  False, socio1, fotos_demo),
            ("ES-005-22", datetime.date(2022, 2, 28), Animal.Sexo.MACHO,   Animal.Estado.APROBADO,  True,  True,  socio1, fotos_demo),
            ("ES-006-22", datetime.date(2022, 7, 14), Animal.Sexo.HEMBRA,  Animal.Estado.RECHAZADO, False, False, socio1, []),
            ("ES-007-23", datetime.date(2023, 1, 8),  Animal.Sexo.MACHO,   Animal.Estado.AÑADIDO,   False, False, socio2, []),
            ("ES-008-21", datetime.date(2021, 9, 3),  Animal.Sexo.HEMBRA,  Animal.Estado.EVALUADO,  True,  True,  socio3, fotos_demo),
        ]

        created_animals = {}
        for (anilla, fecha, sexo, estado, candidato, aprobado, socio, fotos) in specs:
            obj, created = Animal.all_objects.get_or_create(
                tenant=tenant,
                numero_anilla=anilla,
                fecha_nacimiento=fecha,
                defaults={
                    "socio": socio,
                    "sexo": sexo,
                    "estado": estado,
                    "candidato_reproductor": candidato,
                    "reproductor_aprobado": aprobado,
                    "fotos": fotos,
                    "variedad": Animal.Variedad.SALMON,
                },
            )
            if created:
                self.stdout.write(f"  Created animal: {anilla}/{fecha}")
            created_animals[anilla] = obj

        return created_animals

    def _seed_evaluaciones(self, tenant, evaluador, animals):
        from apps.evaluaciones.models import Evaluacion

        evals = [
            ("ES-004-23", {"cabeza": 8, "cola": 7, "pecho_abdomen": 8, "muslos_tarsos": 7, "cresta_babilla": 8, "color": 9, "notas": "Excelente conformación"}),
            ("ES-008-21", {"cabeza": 9, "cola": 8, "pecho_abdomen": 9, "muslos_tarsos": 8, "cresta_babilla": 9, "color": 9, "notas": "Reproductora de alto nivel"}),
        ]
        for (anilla, scores) in evals:
            animal = animals.get(anilla)
            if animal and not Evaluacion.all_objects.filter(animal=animal).exists():
                Evaluacion.all_objects.create(
                    tenant=tenant,
                    animal=animal,
                    evaluador=evaluador,
                    **scores,
                )
                self.stdout.write(f"  Created evaluación: {anilla}")

    def _seed_lotes(self, tenant, socio1, animals):
        from apps.lotes.models import Lote, LoteHembra

        lotes_spec = [
            {
                "nombre": "Temporada 2024 — Primavera",
                "macho_anilla": "ES-003-23",
                "hembras_anillas": ["ES-004-23"],
                "fecha_inicio": "2024-03-01",
                "is_closed": False,
                "fecha_fin": None,
            },
            {
                "nombre": "Temporada 2023 — Cerrado",
                "macho_anilla": "ES-005-22",
                "hembras_anillas": ["ES-008-21"],
                "fecha_inicio": "2023-03-01",
                "fecha_fin": "2023-12-01",
                "is_closed": True,
            },
        ]
        for spec in lotes_spec:
            if Lote.all_objects.filter(tenant=tenant, nombre=spec["nombre"]).exists():
                continue
            macho = animals.get(spec["macho_anilla"])
            lote = Lote.all_objects.create(
                tenant=tenant,
                socio=socio1,
                nombre=spec["nombre"],
                macho=macho,
                fecha_inicio=spec["fecha_inicio"],
                fecha_fin=spec.get("fecha_fin"),
                is_closed=spec["is_closed"],
            )
            for h_anilla in spec["hembras_anillas"]:
                hembra = animals.get(h_anilla)
                if hembra:
                    LoteHembra.objects.get_or_create(lote=lote, hembra=hembra)
            self.stdout.write(f"  Created lote: {lote.nombre}")

    def _seed_anillas(self, tenant, admin_user, socio1, socio2, socio3):
        from apps.anillas.models import EntregaAnillas

        entregas = [
            {"socio": socio1, "anio": 2024, "inicio": "ES001", "fin": "ES050", "diametro": "18"},
            {"socio": socio1, "anio": 2024, "inicio": "ES051", "fin": "ES100", "diametro": "20"},
            {"socio": socio2, "anio": 2023, "inicio": "ES101", "fin": "ES150", "diametro": "18"},
            {"socio": socio3, "anio": 2024, "inicio": "ES201", "fin": "ES250", "diametro": "20"},
        ]
        for e in entregas:
            exists = EntregaAnillas.all_objects.filter(
                tenant=tenant,
                socio=e["socio"],
                anio_campana=e["anio"],
                rango_inicio=e["inicio"],
            ).exists()
            if not exists:
                obj = EntregaAnillas.all_objects.create(
                    tenant=tenant,
                    socio=e["socio"],
                    anio_campana=e["anio"],
                    rango_inicio=e["inicio"],
                    rango_fin=e["fin"],
                    diametro=e["diametro"],
                    created_by=admin_user,
                )
                self.stdout.write(f"  Created entrega anillas: {obj}")

    def _seed_conflictos(self, tenant, socio1, socio2, animals):
        from apps.conflicts.models import Conflicto

        if not Conflicto.all_objects.filter(
            tenant=tenant,
            numero_anilla="ES-007-23",
            anio_nacimiento=2023,
        ).exists():
            Conflicto.all_objects.create(
                tenant=tenant,
                numero_anilla="ES-007-23",
                anio_nacimiento=2023,
                socio_reclamante=socio2,
                socio_actual=socio1,
                estado=Conflicto.Estado.PENDIENTE,
                notas="Conflicto de titularidad demo — anilla ES-007-23",
            )
            self.stdout.write("  Created conflicto: ES-007-23")

    def _seed_realta(self, tenant, socio1, animals):
        from apps.conflicts.models import SolicitudRealta

        animal = animals.get("ES-006-22")
        if animal and not SolicitudRealta.all_objects.filter(
            tenant=tenant,
            animal=animal,
        ).exists():
            SolicitudRealta.all_objects.create(
                tenant=tenant,
                animal=animal,
                solicitante=socio1,
                estado=SolicitudRealta.Estado.PENDIENTE,
                notas="El animal ha superado la cuarentena y está en condiciones de ser reintegrado.",
            )
            self.stdout.write(f"  Created solicitud re-alta: {animal.numero_anilla}")

    def _seed_documentos(self, tenant, admin_user, socio1):
        from apps.documentos.models import Documento

        docs_general = [
            {"nombre": "Reglamento 2024.pdf",        "key": "demo/reglamento_2024.pdf"},
            {"nombre": "Circular Campaña 2024.pdf",  "key": "demo/circular_campana_2024.pdf"},
        ]
        for d in docs_general:
            if not Documento.all_objects.filter(tenant=tenant, nombre_archivo=d["nombre"]).exists():
                Documento.all_objects.create(
                    tenant=tenant,
                    tipo=Documento.Tipo.GENERAL,
                    socio=None,
                    nombre_archivo=d["nombre"],
                    file_key=d["key"],
                    content_type="application/pdf",
                    tamanio_bytes=128000,
                    subido_por=admin_user,
                )
                self.stdout.write(f"  Created documento general: {d['nombre']}")

        doc_particular_nombre = "Certificado Socio.pdf"
        if not Documento.all_objects.filter(
            tenant=tenant,
            nombre_archivo=doc_particular_nombre,
            socio=socio1,
        ).exists():
            Documento.all_objects.create(
                tenant=tenant,
                tipo=Documento.Tipo.PARTICULAR,
                socio=socio1,
                nombre_archivo=doc_particular_nombre,
                file_key="demo/certificado_socio1.pdf",
                content_type="application/pdf",
                tamanio_bytes=64000,
                subido_por=admin_user,
            )
            self.stdout.write(f"  Created documento particular: {doc_particular_nombre}")
