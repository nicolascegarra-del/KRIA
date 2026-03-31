"""
Centralised email utility for KRIA.

Uses PlatformSettings SMTP (or a Tenant's SMTP) instead of the env-var
Django defaults, and logs every attempt to MailLog.
"""
from django.core.mail import get_connection, EmailMessage, EmailMultiAlternatives
from django.conf import settings as django_settings


def send_platform_mail(
    subject: str,
    body: str,
    recipient_list: list[str],
    *,
    html_body: str | None = None,
    tenant=None,
    tipo: str = "GENERAL",
    fail_silently: bool = False,
) -> bool:
    """
    Send an email using PlatformSettings SMTP (global) or tenant-specific SMTP.
    Logs every attempt to MailLog regardless of success/failure.

    Returns True if sent successfully, False otherwise.
    If fail_silently=False and sending fails, re-raises the exception.
    """
    from apps.accounts.models import MailLog

    # ── Resolve SMTP config ────────────────────────────────────────────────────
    if tenant and getattr(tenant, "smtp_host", ""):
        host = tenant.smtp_host
        port = tenant.smtp_port
        user = tenant.smtp_user
        password = tenant.smtp_password
        use_tls = tenant.smtp_use_tls
        use_ssl = tenant.smtp_use_ssl
        from_name = getattr(tenant, "smtp_from_name", "") or ""
        from_addr = getattr(tenant, "smtp_from_email", "") or getattr(tenant, "email_notificaciones", "") or django_settings.DEFAULT_FROM_EMAIL
    else:
        from apps.tenants.models import PlatformSettings
        ps = PlatformSettings.get()
        host = ps.smtp_host
        port = ps.smtp_port
        user = ps.smtp_user
        password = ps.smtp_password
        use_tls = ps.smtp_use_tls
        use_ssl = ps.smtp_use_ssl
        from_name = ps.smtp_from_name or ""
        from_addr = ps.smtp_from_email or django_settings.DEFAULT_FROM_EMAIL

    from_email = f"{from_name} <{from_addr}>" if from_name else from_addr

    # ── Send ───────────────────────────────────────────────────────────────────
    error_msg = ""
    success = False
    try:
        if host:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=int(port),
                username=user,
                password=password,
                use_tls=use_tls,
                use_ssl=use_ssl,
                fail_silently=False,
            )
        else:
            # No SMTP configured — fall back to Django default (usually console/env)
            connection = None

        if html_body:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=body,
                from_email=from_email,
                to=recipient_list,
                connection=connection,
            )
            msg.attach_alternative(html_body, "text/html")
        else:
            msg = EmailMessage(
                subject=subject,
                body=body,
                from_email=from_email,
                to=recipient_list,
                connection=connection,
            )
        msg.send(fail_silently=False)
        success = True
    except Exception as exc:
        error_msg = str(exc)

    # ── Log ────────────────────────────────────────────────────────────────────
    try:
        MailLog.objects.create(
            tipo=tipo,
            destinatarios=", ".join(recipient_list),
            asunto=subject,
            cuerpo=body,
            success=success,
            error=error_msg,
        )
    except Exception:
        pass  # Never let logging break the flow

    if not success:
        if not fail_silently:
            raise Exception(error_msg or "Error desconocido al enviar email")
        return False

    return True
