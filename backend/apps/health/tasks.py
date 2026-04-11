"""
Health check task — runs at 7:30 and 19:30 (Europe/Madrid).
Checks: database, Redis, MinIO, SMTP, Celery workers, stuck jobs.
Sends a summary email to superadmins with notif_health_check=True.
"""
import logging
import traceback
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def _check_database():
    """Verify DB is reachable with a simple query."""
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return True, "OK"
    except Exception as e:
        return False, str(e)


def _check_redis():
    """Ping Redis via Django cache."""
    try:
        from django.core.cache import cache
        cache.set("_health_ping", "pong", timeout=5)
        val = cache.get("_health_ping")
        if val != "pong":
            return False, "ping/pong mismatch"
        return True, "OK"
    except Exception as e:
        return False, str(e)


def _check_minio():
    """Check MinIO bucket is accessible."""
    try:
        from django.conf import settings
        from apps.reports.storage import get_minio_client
        client = get_minio_client()
        client.bucket_exists(settings.MINIO_BUCKET_NAME)
        return True, "OK"
    except Exception as e:
        return False, str(e)


def _check_smtp():
    """Verify SMTP using PlatformSettings — same config as real email sending."""
    import smtplib
    import ssl as ssl_module
    try:
        from apps.tenants.models import PlatformSettings
        ps = PlatformSettings.get()
        host = ps.smtp_host
        port = int(ps.smtp_port or 587)
        user = ps.smtp_user
        password = ps.smtp_password
        use_tls = ps.smtp_use_tls
        use_ssl = ps.smtp_use_ssl
        if not host:
            return False, "Sin configuración SMTP (PlatformSettings vacío)"
        if use_ssl:
            context = ssl_module.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
                if user:
                    server.login(user, password)
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                if use_tls:
                    server.starttls()
                if user:
                    server.login(user, password)
        return True, f"OK ({host}:{port})"
    except Exception as e:
        return False, str(e)


def _check_celery_workers():
    """Check at least one Celery worker is active."""
    try:
        from config.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=3)
        active = inspect.active()
        if not active:
            return False, "No hay workers activos"
        return True, f"{len(active)} worker(s) activo(s)"
    except Exception as e:
        return False, str(e)


def _check_stuck_jobs():
    """Detect import/report jobs stuck in PROCESSING for more than 30 minutes."""
    issues = []
    threshold = timezone.now() - timedelta(minutes=30)
    try:
        from apps.imports.models import ImportJob
        stuck_imports = ImportJob.all_objects.filter(
            status="PROCESSING", created_at__lt=threshold
        ).count()
        if stuck_imports:
            issues.append(f"{stuck_imports} import job(s) bloqueado(s) en PROCESSING")
    except Exception as e:
        issues.append(f"Error comprobando ImportJobs: {e}")

    try:
        from apps.reports.models import ReportJob
        stuck_reports = ReportJob.all_objects.filter(
            status="PROCESSING", created_at__lt=threshold
        ).count()
        if stuck_reports:
            issues.append(f"{stuck_reports} report job(s) bloqueado(s) en PROCESSING")
    except Exception as e:
        issues.append(f"Error comprobando ReportJobs: {e}")

    if issues:
        return False, " | ".join(issues)
    return True, "OK"


CHECKS = [
    ("Base de datos",      _check_database),
    ("Redis / caché",      _check_redis),
    ("MinIO / storage",    _check_minio),
    ("SMTP / email",       _check_smtp),
    ("Workers de Celery",  _check_celery_workers),
    ("Jobs bloqueados",    _check_stuck_jobs),
]


def run_checks() -> list[tuple[str, bool, str]]:
    """Execute all checks and return results list."""
    results = []
    for name, fn in CHECKS:
        try:
            ok, detail = fn()
        except Exception:
            ok, detail = False, traceback.format_exc(limit=3)
        results.append((name, ok, detail))
        status = "OK" if ok else "FAIL"
        logger.info(f"Health check [{name}]: {status} — {detail}")
    return results


def _send_health_email(results: list[tuple[str, bool, str]]):
    """Send health check email to opted-in superadmins. Always logs to MailLog."""
    from apps.accounts.models import User
    from core.mail import send_platform_mail

    recipients = list(
        User.objects.filter(is_superadmin=True, notif_health_check=True, is_active=True)
        .values_list("email", flat=True)
    )

    all_ok = all(ok for _, ok, _ in results)
    now_str = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    subject = f"✅ KRIA — Sistema OK ({now_str})" if all_ok else f"⚠️ KRIA — Fallos detectados ({now_str})"

    lines = [f"Informe de estado — {now_str}\n"]
    for name, ok, detail in results:
        lines.append(f"{'✅' if ok else '❌'}  {name}: {detail}")
    if not all_ok:
        lines.append("\nRevisa el sistema o contacta con el equipo técnico.")
    body = "\n".join(lines)

    if not recipients:
        logger.warning("Health check: sin destinatarios (ningún superadmin tiene notif_health_check=True)")
        try:
            from apps.accounts.models import MailLog
            MailLog.objects.create(
                tipo="HEALTH_CHECK",
                destinatarios="(ninguno)",
                asunto=subject,
                cuerpo=body,
                success=False,
                error="Sin destinatarios (ningún superadmin tiene notif_health_check=True)",
            )
        except Exception as e:
            logger.error(f"Health check: error guardando MailLog: {e}")
        return

    try:
        send_platform_mail(subject=subject, body=body, recipient_list=recipients, tipo="HEALTH_CHECK", fail_silently=False)
    except Exception as e:
        logger.error(f"Health check: error enviando email: {e}")


@shared_task(name="apps.health.tasks.run_health_check", bind=True, max_retries=0)
def run_health_check(self):
    _send_health_email(run_checks())
