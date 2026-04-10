"""
Celery tasks: export_backup y import_backup por tenant.
"""
import io
import json
import logging
import mimetypes
import traceback
import uuid as uuid_mod
import zipfile
from datetime import date, datetime
from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

BACKUP_VERSION = "1.0"
KRIA_VERSION = "0.4"


# ── JSON encoder ───────────────────────────────────────────────────────────────

class _Encoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid_mod.UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)


def _dump(qs) -> str:
    return json.dumps(list(qs.values()), cls=_Encoder)


def _load(zf: zipfile.ZipFile, path: str) -> list:
    try:
        return json.loads(zf.read(path).decode("utf-8"))
    except KeyError:
        return []


def _fetch_media(client, bucket: str, key: str) -> bytes | None:
    try:
        resp = client.get_object(bucket, key)
        data = resp.read()
        resp.close()
        return data
    except Exception:
        return None


def _logo_key_from_url(logo_url: str) -> str | None:
    if not logo_url:
        return None
    bucket = settings.MINIO_BUCKET_NAME
    marker = f"/{bucket}/"
    idx = logo_url.find(marker)
    return logo_url[idx + len(marker):] if idx != -1 else None


# ══════════════════════════════════════════════════════════════════════════════
#  EXPORT
# ══════════════════════════════════════════════════════════════════════════════

@shared_task(name="backups.export_backup", queue="imports", bind=True, max_retries=0)
def export_backup(self, job_id: str):
    from .models import BackupJob
    from apps.tenants.models import Tenant
    from apps.accounts.models import User, Socio, SolicitudCambioDatos, Notificacion
    from apps.animals.models import Animal, MotivoBaja, GanaderiaNacimientoMap, LoteExternoMap
    from apps.lotes.models import Lote, LoteHembra
    from apps.anillas.models import EntregaAnillas
    from apps.granjas.models import Granja
    from apps.evaluaciones.models import Evaluacion
    from apps.conflicts.models import Conflicto, SolicitudRealta
    from apps.documentos.models import Documento
    from apps.audits.models import (
        CriterioEvaluacion, PreguntaInstalacion,
        AuditoriaSession, AuditoriaAnimal, AuditoriaRespuesta,
    )
    from apps.reports.storage import get_minio_client, upload_bytes

    try:
        job = BackupJob.objects.get(pk=job_id)
    except BackupJob.DoesNotExist:
        logger.error("BackupJob %s not found.", job_id)
        return

    job.status = BackupJob.Status.RUNNING
    job.save(update_fields=["status"])

    try:
        tenant = Tenant.objects.get(pk=job.tenant_id_snapshot)
        client = get_minio_client()
        bucket = settings.MINIO_BUCKET_NAME
        counts: dict = {}
        buf = io.BytesIO()

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:

            # ── Datos estructurados ────────────────────────────────────────────

            # 01 Tenant
            zf.writestr("data/01_tenant.json", json.dumps(
                list(Tenant.objects.filter(pk=tenant.pk).values()), cls=_Encoder
            ))
            counts["tenant"] = 1

            # 02 Usuarios de gestión (no superadmin)
            users_qs = User.objects.filter(tenant=tenant, is_superadmin=False)
            zf.writestr("data/02_users.json", _dump(users_qs))
            counts["users"] = users_qs.count()

            # 03 Socios
            socios_qs = Socio.all_objects.filter(tenant=tenant)
            zf.writestr("data/03_socios.json", _dump(socios_qs))
            counts["socios"] = socios_qs.count()

            # 04 Solicitudes de cambio de datos
            scd_qs = SolicitudCambioDatos.objects.filter(tenant=tenant)
            zf.writestr("data/04_solicitudes_cambio.json", _dump(scd_qs))
            counts["solicitudes_cambio"] = scd_qs.count()

            # 05 Notificaciones
            notif_qs = Notificacion.objects.filter(tenant=tenant)
            zf.writestr("data/05_notificaciones.json", _dump(notif_qs))
            counts["notificaciones"] = notif_qs.count()

            # 06 Granjas
            granjas_qs = Granja.all_objects.filter(tenant=tenant)
            zf.writestr("data/06_granjas.json", _dump(granjas_qs))
            counts["granjas"] = granjas_qs.count()

            # 07 Motivos de baja
            motivos_qs = MotivoBaja.all_objects.filter(tenant=tenant)
            zf.writestr("data/07_motivos_baja.json", _dump(motivos_qs))
            counts["motivos_baja"] = motivos_qs.count()

            # 08 Lotes (macho_id incluido; se aplicará en dos pasadas al importar)
            lotes_qs = Lote.all_objects.filter(tenant=tenant)
            zf.writestr("data/08_lotes.json", _dump(lotes_qs))
            counts["lotes"] = lotes_qs.count()

            # 09 Anillas
            anillas_qs = EntregaAnillas.all_objects.filter(tenant=tenant)
            zf.writestr("data/09_anillas.json", _dump(anillas_qs))
            counts["anillas"] = anillas_qs.count()

            # 10 Animales (padre_id / madre_animal_id incluidos; dos pasadas al importar)
            animals_qs = Animal.all_objects.filter(tenant=tenant)
            zf.writestr("data/10_animals.json", _dump(animals_qs))
            counts["animals"] = animals_qs.count()

            # 11 LoteHembras (tabla M2M through)
            lote_ids = list(lotes_qs.values_list("id", flat=True))
            lhembras_qs = LoteHembra.objects.filter(lote_id__in=lote_ids)
            zf.writestr("data/11_lote_hembras.json", _dump(lhembras_qs))
            counts["lote_hembras"] = lhembras_qs.count()

            # 12 GanaderiaNacimientoMap
            gmap_qs = GanaderiaNacimientoMap.all_objects.filter(tenant=tenant)
            zf.writestr("data/12_ganaderia_maps.json", _dump(gmap_qs))
            counts["ganaderia_maps"] = gmap_qs.count()

            # 13 LoteExternoMap
            lemap_qs = LoteExternoMap.all_objects.filter(tenant=tenant)
            zf.writestr("data/13_lote_externo_maps.json", _dump(lemap_qs))
            counts["lote_externo_maps"] = lemap_qs.count()

            # 14 Evaluaciones
            eval_qs = Evaluacion.all_objects.filter(tenant=tenant)
            zf.writestr("data/14_evaluaciones.json", _dump(eval_qs))
            counts["evaluaciones"] = eval_qs.count()

            # 15 Solicitudes de re-alta
            realta_qs = SolicitudRealta.all_objects.filter(tenant=tenant)
            zf.writestr("data/15_solicitudes_realta.json", _dump(realta_qs))
            counts["solicitudes_realta"] = realta_qs.count()

            # 16 Conflictos
            confl_qs = Conflicto.all_objects.filter(tenant=tenant)
            zf.writestr("data/16_conflictos.json", _dump(confl_qs))
            counts["conflictos"] = confl_qs.count()

            # 17 Documentos
            docs_qs = Documento.all_objects.filter(tenant=tenant)
            zf.writestr("data/17_documentos.json", _dump(docs_qs))
            counts["documentos"] = docs_qs.count()

            # 18 Criterios de evaluación (auditorías)
            crit_qs = CriterioEvaluacion.all_objects.filter(tenant=tenant)
            zf.writestr("data/18_criterios_evaluacion.json", _dump(crit_qs))
            counts["criterios_evaluacion"] = crit_qs.count()

            # 19 Preguntas de instalación (auditorías)
            preg_qs = PreguntaInstalacion.all_objects.filter(tenant=tenant)
            zf.writestr("data/19_preguntas_instalacion.json", _dump(preg_qs))
            counts["preguntas_instalacion"] = preg_qs.count()

            # 20 Sesiones de auditoría
            aud_qs = AuditoriaSession.all_objects.filter(tenant=tenant)
            zf.writestr("data/20_auditorias.json", _dump(aud_qs))
            counts["auditorias"] = aud_qs.count()

            # 21 Evaluaciones de animal en auditoría
            aud_ids = list(aud_qs.values_list("id", flat=True))
            aaud_qs = AuditoriaAnimal.objects.filter(auditoria_id__in=aud_ids)
            zf.writestr("data/21_auditoria_animals.json", _dump(aaud_qs))
            counts["auditoria_animals"] = aaud_qs.count()

            # 22 Respuestas de instalación en auditoría
            aresp_qs = AuditoriaRespuesta.objects.filter(auditoria_id__in=aud_ids)
            zf.writestr("data/22_auditoria_respuestas.json", _dump(aresp_qs))
            counts["auditoria_respuestas"] = aresp_qs.count()

            # ── Archivos de media ──────────────────────────────────────────────
            media_count = 0

            # Logo del tenant
            logo_key = _logo_key_from_url(tenant.logo_url)
            if logo_key:
                logo_bytes = _fetch_media(client, bucket, logo_key)
                if logo_bytes:
                    zf.writestr(f"media/{logo_key}", logo_bytes)
                    media_count += 1

            # Fotos de animales
            for animal in animals_qs:
                for entry in (animal.fotos or []):
                    key = entry.get("key")
                    if key:
                        foto_bytes = _fetch_media(client, bucket, key)
                        if foto_bytes:
                            zf.writestr(f"media/{key}", foto_bytes)
                            media_count += 1

            # Archivos de documentos
            for doc in docs_qs:
                if doc.file_key:
                    doc_bytes = _fetch_media(client, bucket, doc.file_key)
                    if doc_bytes:
                        zf.writestr(f"media/{doc.file_key}", doc_bytes)
                        media_count += 1

            counts["media_files"] = media_count

            # ── Manifest ──────────────────────────────────────────────────────
            manifest = {
                "version": BACKUP_VERSION,
                "kria_version": KRIA_VERSION,
                "created_at": timezone.now().isoformat(),
                "tenant": {
                    "id": str(tenant.id),
                    "slug": tenant.slug,
                    "name": tenant.name,
                },
                "counts": counts,
            }
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))

        # Subir ZIP a MinIO
        zip_bytes = buf.getvalue()
        ts = timezone.now().strftime("%Y%m%dT%H%M%S")
        file_key = f"backups/exports/{tenant.slug}_{ts}_{str(job.id)[:8]}.zip"
        upload_bytes(file_key, zip_bytes, "application/zip")

        job.status = BackupJob.Status.COMPLETED
        job.file_key = file_key
        job.file_size_bytes = len(zip_bytes)
        job.completed_at = timezone.now()
        job.result_summary = counts
        job.save(update_fields=["status", "file_key", "file_size_bytes", "completed_at", "result_summary"])
        logger.info("BackupJob %s EXPORT OK — %d bytes.", job_id, len(zip_bytes))

    except Exception as exc:
        logger.error("BackupJob %s EXPORT FAILED: %s\n%s", job_id, exc, traceback.format_exc())
        try:
            job.status = BackupJob.Status.FAILED
            job.error_message = str(exc)[:2000]
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "error_message", "completed_at"])
        except Exception:
            pass


# ══════════════════════════════════════════════════════════════════════════════
#  IMPORT
# ══════════════════════════════════════════════════════════════════════════════

def _create(model_cls, rec: dict, ts_fields=("created_at",), update_ts_fields=("updated_at",)):
    """Crea un objeto preservando timestamps auto_now/auto_now_add via update()."""
    saved_ts = {}
    for f in ts_fields + update_ts_fields:
        val = rec.pop(f, None)
        if val:
            saved_ts[f] = val
    obj = model_cls(**rec)
    obj.save()
    if saved_ts:
        model_cls.objects.filter(pk=obj.pk).update(**saved_ts)
    return obj


@shared_task(name="backups.import_backup", queue="imports", bind=True, max_retries=0)
def import_backup(self, job_id: str):
    from .models import BackupJob
    from apps.tenants.models import Tenant
    from apps.accounts.models import User, Socio, SolicitudCambioDatos, Notificacion
    from apps.animals.models import Animal, MotivoBaja, GanaderiaNacimientoMap, LoteExternoMap
    from apps.lotes.models import Lote, LoteHembra
    from apps.anillas.models import EntregaAnillas
    from apps.granjas.models import Granja
    from apps.evaluaciones.models import Evaluacion
    from apps.conflicts.models import Conflicto, SolicitudRealta
    from apps.documentos.models import Documento
    from apps.audits.models import (
        CriterioEvaluacion, PreguntaInstalacion,
        AuditoriaSession, AuditoriaAnimal, AuditoriaRespuesta,
    )
    from apps.reports.storage import get_minio_client, upload_bytes, get_presigned_download_url

    try:
        job = BackupJob.objects.get(pk=job_id)
    except BackupJob.DoesNotExist:
        logger.error("BackupJob %s not found.", job_id)
        return

    job.status = BackupJob.Status.RUNNING
    job.save(update_fields=["status"])

    try:
        client = get_minio_client()
        bucket = settings.MINIO_BUCKET_NAME

        # Descargar ZIP desde MinIO
        resp = client.get_object(bucket, job.file_key)
        zip_bytes = resp.read()
        resp.close()

        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
            tenant_info = manifest["tenant"]
            tenant_id = tenant_info["id"]
            tenant_slug = tenant_info["slug"]

            # Validar que el tenant no existe
            if Tenant.objects.filter(pk=tenant_id).exists():
                raise ValueError(f"Ya existe una asociación con UUID {tenant_id}.")
            if Tenant.objects.filter(slug=tenant_slug).exists():
                raise ValueError(f"Ya existe una asociación con slug '{tenant_slug}'.")

            counts: dict = {}

            with transaction.atomic():
                # ── 01 Tenant ──────────────────────────────────────────────────
                t_data = _load(zf, "data/01_tenant.json")
                if not t_data:
                    raise ValueError("El backup no contiene datos del tenant.")
                rec = dict(t_data[0])
                rec.pop("created_at", None)
                tenant_obj = Tenant(**rec)
                tenant_obj.save()
                counts["tenant"] = 1

                # ── 02 Usuarios ────────────────────────────────────────────────
                for rec in _load(zf, "data/02_users.json"):
                    rec = dict(rec)
                    date_joined = rec.pop("date_joined", None)
                    u = User(**rec)
                    u.save()
                    if date_joined:
                        User.objects.filter(pk=u.pk).update(date_joined=date_joined)
                counts["users"] = len(_load(zf, "data/02_users.json"))

                # ── 03 Socios ──────────────────────────────────────────────────
                socios_data = _load(zf, "data/03_socios.json")
                for rec in socios_data:
                    Socio.all_objects.create(**rec)
                counts["socios"] = len(socios_data)

                # ── 04 Solicitudes cambio datos ────────────────────────────────
                scd_data = _load(zf, "data/04_solicitudes_cambio.json")
                for rec in scd_data:
                    rec = dict(rec)
                    rec.pop("created_at", None)
                    SolicitudCambioDatos.objects.create(**rec)
                counts["solicitudes_cambio"] = len(scd_data)

                # ── 05 Notificaciones ──────────────────────────────────────────
                notif_data = _load(zf, "data/05_notificaciones.json")
                for rec in notif_data:
                    rec = dict(rec)
                    rec.pop("created_at", None)
                    Notificacion.objects.create(**rec)
                counts["notificaciones"] = len(notif_data)

                # ── 06 Granjas ─────────────────────────────────────────────────
                granjas_data = _load(zf, "data/06_granjas.json")
                for rec in granjas_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    g = Granja.all_objects.create(**rec)
                    if created_at:
                        Granja.all_objects.filter(pk=g.pk).update(created_at=created_at)
                counts["granjas"] = len(granjas_data)

                # ── 07 Motivos de baja ─────────────────────────────────────────
                motivos_data = _load(zf, "data/07_motivos_baja.json")
                for rec in motivos_data:
                    MotivoBaja.all_objects.create(**rec)
                counts["motivos_baja"] = len(motivos_data)

                # ── 08 Lotes (sin macho — se asigna en la segunda pasada) ──────
                lotes_data = _load(zf, "data/08_lotes.json")
                lote_macho_map: dict = {}
                for rec in lotes_data:
                    rec = dict(rec)
                    macho_id = rec.pop("macho_id", None)
                    if macho_id:
                        lote_macho_map[rec["id"]] = macho_id
                    created_at = rec.pop("created_at", None)
                    lote = Lote.all_objects.create(**rec)
                    if created_at:
                        Lote.all_objects.filter(pk=lote.pk).update(created_at=created_at)
                counts["lotes"] = len(lotes_data)

                # ── 09 Anillas ─────────────────────────────────────────────────
                anillas_data = _load(zf, "data/09_anillas.json")
                for rec in anillas_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    ea = EntregaAnillas.all_objects.create(**rec)
                    if created_at:
                        EntregaAnillas.all_objects.filter(pk=ea.pk).update(created_at=created_at)
                counts["anillas"] = len(anillas_data)

                # ── 10 Animales — primera pasada (sin padre / madre_animal) ────
                animals_data = _load(zf, "data/10_animals.json")
                animal_padre_map: dict = {}
                animal_madre_map: dict = {}
                for rec in animals_data:
                    rec = dict(rec)
                    padre_id = rec.pop("padre_id", None)
                    madre_id = rec.pop("madre_animal_id", None)
                    if padre_id:
                        animal_padre_map[rec["id"]] = padre_id
                    if madre_id:
                        animal_madre_map[rec["id"]] = madre_id
                    created_at = rec.pop("created_at", None)
                    updated_at = rec.pop("updated_at", None)
                    a = Animal.all_objects.create(**rec)
                    ts_kw = {}
                    if created_at:
                        ts_kw["created_at"] = created_at
                    if updated_at:
                        ts_kw["updated_at"] = updated_at
                    if ts_kw:
                        Animal.all_objects.filter(pk=a.pk).update(**ts_kw)
                counts["animals"] = len(animals_data)

                # ── 10b Animales — segunda pasada: genealogía ──────────────────
                for animal_id, padre_id in animal_padre_map.items():
                    Animal.all_objects.filter(pk=animal_id).update(padre_id=padre_id)
                for animal_id, madre_id in animal_madre_map.items():
                    Animal.all_objects.filter(pk=animal_id).update(madre_animal_id=madre_id)

                # ── 08b Lotes — segunda pasada: macho ─────────────────────────
                for lote_id, macho_id in lote_macho_map.items():
                    Lote.all_objects.filter(pk=lote_id).update(macho_id=macho_id)

                # ── 11 LoteHembras ─────────────────────────────────────────────
                lhembras_data = _load(zf, "data/11_lote_hembras.json")
                for rec in lhembras_data:
                    rec = dict(rec)
                    rec.pop("id", None)  # int auto-pk: dejar que Django asigne nuevo
                    LoteHembra.objects.create(**rec)
                counts["lote_hembras"] = len(lhembras_data)

                # ── 12 GanaderiaNacimientoMap ──────────────────────────────────
                gmap_data = _load(zf, "data/12_ganaderia_maps.json")
                for rec in gmap_data:
                    GanaderiaNacimientoMap.all_objects.create(**rec)
                counts["ganaderia_maps"] = len(gmap_data)

                # ── 13 LoteExternoMap ──────────────────────────────────────────
                lemap_data = _load(zf, "data/13_lote_externo_maps.json")
                for rec in lemap_data:
                    LoteExternoMap.all_objects.create(**rec)
                counts["lote_externo_maps"] = len(lemap_data)

                # ── 14 Evaluaciones ────────────────────────────────────────────
                eval_data = _load(zf, "data/14_evaluaciones.json")
                for rec in eval_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    e = Evaluacion.all_objects.create(**rec)
                    if created_at:
                        Evaluacion.all_objects.filter(pk=e.pk).update(created_at=created_at)
                counts["evaluaciones"] = len(eval_data)

                # ── 15 Solicitudes re-alta ─────────────────────────────────────
                realta_data = _load(zf, "data/15_solicitudes_realta.json")
                for rec in realta_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    r = SolicitudRealta.all_objects.create(**rec)
                    if created_at:
                        SolicitudRealta.all_objects.filter(pk=r.pk).update(created_at=created_at)
                counts["solicitudes_realta"] = len(realta_data)

                # ── 16 Conflictos ──────────────────────────────────────────────
                confl_data = _load(zf, "data/16_conflictos.json")
                for rec in confl_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    c = Conflicto.all_objects.create(**rec)
                    if created_at:
                        Conflicto.all_objects.filter(pk=c.pk).update(created_at=created_at)
                counts["conflictos"] = len(confl_data)

                # ── 17 Documentos ──────────────────────────────────────────────
                docs_data = _load(zf, "data/17_documentos.json")
                for rec in docs_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    d = Documento.all_objects.create(**rec)
                    if created_at:
                        Documento.all_objects.filter(pk=d.pk).update(created_at=created_at)
                counts["documentos"] = len(docs_data)

                # ── 18 Criterios de evaluación ─────────────────────────────────
                crit_data = _load(zf, "data/18_criterios_evaluacion.json")
                for rec in crit_data:
                    CriterioEvaluacion.all_objects.create(**rec)
                counts["criterios_evaluacion"] = len(crit_data)

                # ── 19 Preguntas de instalación ────────────────────────────────
                preg_data = _load(zf, "data/19_preguntas_instalacion.json")
                for rec in preg_data:
                    PreguntaInstalacion.all_objects.create(**rec)
                counts["preguntas_instalacion"] = len(preg_data)

                # ── 20 Auditorías ──────────────────────────────────────────────
                aud_data = _load(zf, "data/20_auditorias.json")
                for rec in aud_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    updated_at = rec.pop("updated_at", None)
                    a = AuditoriaSession.all_objects.create(**rec)
                    ts_kw = {}
                    if created_at:
                        ts_kw["created_at"] = created_at
                    if updated_at:
                        ts_kw["updated_at"] = updated_at
                    if ts_kw:
                        AuditoriaSession.all_objects.filter(pk=a.pk).update(**ts_kw)
                counts["auditorias"] = len(aud_data)

                # ── 21 AuditoriaAnimal ─────────────────────────────────────────
                aaud_data = _load(zf, "data/21_auditoria_animals.json")
                for rec in aaud_data:
                    rec = dict(rec)
                    created_at = rec.pop("created_at", None)
                    aa = AuditoriaAnimal.objects.create(**rec)
                    if created_at:
                        AuditoriaAnimal.objects.filter(pk=aa.pk).update(created_at=created_at)
                counts["auditoria_animals"] = len(aaud_data)

                # ── 22 AuditoriaRespuesta ──────────────────────────────────────
                aresp_data = _load(zf, "data/22_auditoria_respuestas.json")
                for rec in aresp_data:
                    AuditoriaRespuesta.objects.create(**rec)
                counts["auditoria_respuestas"] = len(aresp_data)

                # ── Media: restaurar todos los archivos ────────────────────────
                media_count = 0
                media_prefix = "media/"
                for name in zf.namelist():
                    if not name.startswith(media_prefix) or name == media_prefix:
                        continue
                    original_key = name[len(media_prefix):]
                    if not original_key:
                        continue
                    file_bytes = zf.read(name)
                    ct, _ = mimetypes.guess_type(original_key)
                    upload_bytes(original_key, file_bytes, ct or "application/octet-stream")
                    media_count += 1

                counts["media_files"] = media_count

                # ── Actualizar logo_url del tenant con la URL del nuevo servidor ─
                logo_key = _logo_key_from_url(tenant_obj.logo_url)
                if logo_key:
                    new_url = get_presigned_download_url(logo_key)
                    Tenant.objects.filter(pk=tenant_obj.pk).update(logo_url=new_url)

        # Limpiar el ZIP de importación de MinIO
        try:
            client.remove_object(bucket, job.file_key)
        except Exception:
            pass

        job.status = BackupJob.Status.COMPLETED
        job.file_key = ""
        job.completed_at = timezone.now()
        job.result_summary = counts
        job.save(update_fields=["status", "file_key", "completed_at", "result_summary"])
        logger.info("BackupJob %s IMPORT OK.", job_id)

    except Exception as exc:
        logger.error("BackupJob %s IMPORT FAILED: %s\n%s", job_id, exc, traceback.format_exc())
        try:
            job.status = BackupJob.Status.FAILED
            job.error_message = str(exc)[:2000]
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "error_message", "completed_at"])
        except Exception:
            pass
