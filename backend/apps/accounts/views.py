"""
Account views: JWT login, password reset, Socio CRUD.
"""
import uuid
from datetime import timedelta

from django.conf import settings
from core.mail import send_platform_mail
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.permissions import IsGestion, IsSocioOrGestion, get_effective_is_gestion
from .models import Socio, User
from .serializers import (
    CustomTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    SocioListSerializer,
    SocioSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                from .models import UserAccessLog
                email = request.data.get("email", "")
                tenant = getattr(request, "tenant", None)

                # The login endpoint is public — the middleware may not resolve the
                # tenant when the request comes from the main domain (no subdomain,
                # no X-Tenant-Slug, no JWT yet). Fall back to the tenant_id that
                # the serializer embedded in the response payload, which is always
                # present for every authenticated user (including superadmins via
                # the system tenant).
                if tenant is None:
                    user_data = response.data.get("user", {})
                    tenant_id = user_data.get("tenant_id")
                    if tenant_id:
                        from apps.tenants.models import Tenant as TenantModel
                        tenant = TenantModel.objects.filter(id=tenant_id).first()

                user = User.objects.filter(email=email, tenant=tenant).first()
                role = "socio"
                if user:
                    if user.is_superadmin:
                        role = "superadmin"
                    elif user.is_gestion:
                        role = "gestion"
                ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR")
                UserAccessLog.objects.create(
                    tenant=tenant,
                    tenant_name=tenant.name if tenant else "",
                    user_email=email,
                    user_role=role,
                    ip_address=ip or None,
                )
            except Exception:
                pass  # Never break login due to logging failure
        return response


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        tenant = getattr(request, "tenant", None)

        # Tenant may not resolve for public endpoints on the main domain
        # (e.g. kria.klyp.es vs agamur.klyp.es). Search across all tenants
        # by email in that case, but exclude superadmins (they don't reset via this flow).
        if tenant:
            users = list(User.objects.filter(email=email, tenant=tenant, is_active=True, is_superadmin=False))
        else:
            users = list(User.objects.filter(email=email, is_active=True, is_superadmin=False))

        if not users:
            return Response({"detail": "If that email exists, a reset link was sent."})

        from django.template.loader import render_to_string

        for user in users:
            token = uuid.uuid4()
            user.reset_token = token
            user.reset_token_created = timezone.now()
            user.save(update_fields=["reset_token", "reset_token_created"])

            reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
            tenant_name = user.tenant.name if user.tenant_id else "KRIA"

            html_body = render_to_string("email/password_reset.html", {
                "tenant_name": tenant_name,
                "reset_url": reset_url,
            })

            send_platform_mail(
                subject=f"Restablecimiento de contraseña — {tenant_name}",
                body=f"Haz clic en el enlace para restablecer tu contraseña:\n{reset_url}\n\nEste enlace expira en 24 horas.",
                html_body=html_body,
                recipient_list=[email],
                tipo="RESET_PASSWORD",
                fail_silently=True,
            )

        return Response({"detail": "If that email exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["new_password"]

        try:
            user = User.objects.get(reset_token=token)
        except User.DoesNotExist:
            return Response({"detail": "Invalid or expired token."}, status=400)

        timeout = timedelta(seconds=settings.PASSWORD_RESET_TIMEOUT)
        if user.reset_token_created and timezone.now() - user.reset_token_created > timeout:
            return Response({"detail": "Token expired."}, status=400)

        user.set_password(new_password)
        user.reset_token = None
        user.reset_token_created = None
        user.save(update_fields=["password", "reset_token", "reset_token_created"])

        return Response({"detail": "Password updated successfully."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_gestion": user.is_gestion,
            "is_superadmin": user.is_superadmin,
            "tenant_id": str(user.tenant_id),
            "tenant_slug": user.tenant.slug,
        }
        return Response(data)


# ── Socio Views ───────────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")

        if not current_password or not new_password:
            return Response(
                {"detail": "current_password y new_password son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.check_password(current_password):
            return Response(
                {"detail": "La contraseña actual es incorrecta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "La nueva contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada correctamente."})


class SocioPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class SocioListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsGestion]
    pagination_class = SocioPagination

    def get_serializer_class(self):
        if self.request.method == "GET":
            return SocioListSerializer
        return SocioSerializer

    def get_queryset(self):
        from django.db.models import Q
        qs = Socio.objects.select_related("user")

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(nombre_razon_social__icontains=search)
                | Q(dni_nif__icontains=search)
                | Q(numero_socio__icontains=search)
                | Q(user__email__icontains=search)  # null user → no match, safe with LEFT JOIN
            )

        estado = self.request.query_params.get("estado", "")
        if estado in ("ALTA", "BAJA"):
            qs = qs.filter(estado=estado)

        cuota = self.request.query_params.get("cuota", "")
        if cuota:
            try:
                qs = qs.filter(cuota_anual_pagada__gte=int(cuota))
            except ValueError:
                pass

        from django.db.models.expressions import RawSQL

        # Normalize accented Spanish characters for correct alphabetical ordering
        _NOMBRE_SORT = RawSQL(
            "LOWER(TRANSLATE(nombre_razon_social,"
            " 'ÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÑñ',"
            " 'AEIOUaeiouAEIOUaeiouAEIOUaeiouNn'))",
            [],
        )

        ordering = self.request.query_params.get("ordering", "nombre_razon_social")
        if ordering in ("numero_socio", "-numero_socio"):
            # Cast to integer for correct numeric ordering; non-numeric values sort last
            from django.db.models import OrderBy
            expr = RawSQL(
                "CASE WHEN numero_socio ~ '^[0-9]+$' THEN numero_socio::bigint ELSE NULL END",
                [],
            )
            desc = ordering.startswith("-")
            return qs.order_by(OrderBy(expr, descending=desc, nulls_last=True))
        elif ordering == "-nombre_razon_social":
            return qs.annotate(nombre_sort=_NOMBRE_SORT).order_by("-nombre_sort")
        else:
            return qs.annotate(nombre_sort=_NOMBRE_SORT).order_by("nombre_sort")

    def create(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if tenant and tenant.max_socios > 0:
            current_count = Socio.all_objects.filter(
                tenant=tenant, estado=Socio.Estado.ALTA
            ).count()
            if current_count >= tenant.max_socios:
                return Response(
                    {
                        "detail": (
                            f"Límite de socios alcanzado ({tenant.max_socios}). "
                            "Contacte con el administrador de la plataforma para ampliar la suscripción."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().create(request, *args, **kwargs)


class SocioCuotaYearsView(APIView):
    """GET /socios/cuota-years/ — años de cuota distintos registrados en el tenant."""
    permission_classes = [IsGestion]

    def get(self, request):
        years = (
            Socio.objects.filter(cuota_anual_pagada__isnull=False)
            .values_list("cuota_anual_pagada", flat=True)
            .distinct()
            .order_by("-cuota_anual_pagada")
        )
        return Response(list(years))


class SocioDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsGestion]
    serializer_class = SocioSerializer

    def get_queryset(self):
        return Socio.objects.select_related("user").all()


class SocioMeView(APIView):
    """Returns the Socio record linked to the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            socio = Socio.objects.select_related("user").get(user=request.user)
        except Socio.DoesNotExist:
            return Response({"detail": "No tienes un perfil de socio."}, status=404)
        return Response(SocioListSerializer(socio).data)


class SocioDarBajaView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            socio = Socio.objects.get(pk=pk)
        except Socio.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if socio.estado == Socio.Estado.BAJA:
            return Response({"detail": "Socio ya está en BAJA."}, status=400)

        razon = request.data.get("razon_baja", "")
        fecha_baja = request.data.get("fecha_baja")
        from django.utils import timezone as tz
        if fecha_baja:
            try:
                from datetime import date
                fecha_baja = date.fromisoformat(str(fecha_baja))
            except (ValueError, TypeError):
                return Response({"detail": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400)
        else:
            fecha_baja = tz.now().date()
        socio.estado = Socio.Estado.BAJA
        socio.razon_baja = razon
        socio.fecha_baja = fecha_baja
        socio.save()

        return Response({"detail": "Socio dado de baja correctamente."})


class SocioReactivarView(APIView):
    permission_classes = [IsGestion]

    def post(self, request, pk):
        try:
            socio = Socio.objects.get(pk=pk)
        except Socio.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if socio.estado == Socio.Estado.ALTA:
            return Response({"detail": "Socio ya está en ALTA."}, status=400)

        socio.estado = Socio.Estado.ALTA
        socio.razon_baja = ""
        socio.fecha_baja = None
        socio.save(update_fields=["estado", "razon_baja", "fecha_baja"])

        return Response({"detail": "Socio reactivado correctamente."})


# ── Enviar acceso al socio ────────────────────────────────────────────────────

class SocioEnviarAccesoView(APIView):
    """POST /api/v1/socios/:pk/enviar-acceso/
    Gestión envía al socio un correo con la URL de la plataforma, su usuario
    y un enlace para establecer/restablecer su contraseña (válido 24 h).
    """
    permission_classes = [IsGestion]

    def post(self, request, pk):
        from django.template.loader import render_to_string

        try:
            socio = Socio.objects.select_related("user", "tenant").get(pk=pk)
        except Socio.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not socio.user_id or not socio.user.email:
            return Response(
                {"detail": "El socio no tiene usuario ni correo electrónico asociado."},
                status=400,
            )

        user = socio.user
        tenant = socio.tenant

        # If the account has no usable password yet, ensure it stays unusable
        # so the socio MUST use the setup link (not try to log in without password).
        # If they already have a usable password this is a "reset link" — keep it.
        token = uuid.uuid4()
        if not user.has_usable_password():
            user.set_unusable_password()
            user.reset_token = token
            user.reset_token_created = timezone.now()
            user.save(update_fields=["password", "reset_token", "reset_token_created"])
        else:
            user.reset_token = token
            user.reset_token_created = timezone.now()
            user.save(update_fields=["reset_token", "reset_token_created"])

        # Construct the tenant-specific platform URL
        suffix = getattr(settings, "TENANT_DOMAIN_SUFFIX", "")
        if getattr(tenant, "custom_domain", None):
            platform_url = f"https://{tenant.custom_domain}"
        elif suffix and not settings.FRONTEND_URL.startswith("http://localhost"):
            platform_url = f"https://{tenant.slug}{suffix}"
        else:
            platform_url = settings.FRONTEND_URL

        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
        tenant_name = tenant.name if tenant else "KRIA"

        html_body = render_to_string("email/enviar_acceso.html", {
            "tenant_name": tenant_name,
            "socio_nombre": socio.nombre_razon_social,
            "platform_url": platform_url,
            "username": user.email,
            "reset_url": reset_url,
        })

        plain_body = (
            f"Hola {socio.nombre_razon_social},\n\n"
            f"Aquí tienes tus datos de acceso a {tenant_name} en KRIA:\n\n"
            f"  Enlace de acceso: {platform_url}\n"
            f"  Usuario: {user.email}\n"
            f"  Establecer contraseña: {reset_url}\n\n"
            f"El enlace para crear tu contraseña expira en 24 horas.\n\n"
            f"Para un acceso rápido desde el móvil puedes añadir la aplicación\n"
            f"a tu pantalla de inicio:\n"
            f"  • iPhone/iPad: abre el enlace en Safari → botón Compartir → "
            f"'Añadir a pantalla de inicio'\n"
            f"  • Android: abre el enlace en Chrome → menú (⋮) → "
            f"'Añadir a pantalla de inicio'\n"
        )

        send_platform_mail(
            subject=f"Tu acceso a {tenant_name} — KRIA",
            body=plain_body,
            html_body=html_body,
            recipient_list=[user.email],
            tipo="ENVIO_ACCESO",
            tenant=tenant,
            fail_silently=False,
        )

        return Response({"detail": "Correo de acceso enviado correctamente."})


# ── Notificaciones ────────────────────────────────────────────────────────────

class NotificacionListView(APIView):
    """GET /api/v1/notificaciones/ — all notifications for the current user.
    count = number of unread ones (for the badge).
    results = all notifications, read and unread, newest first.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import Notificacion, Socio
        from datetime import date

        # All notifications, newest first, capped at 50
        nots = Notificacion.objects.filter(usuario=request.user).order_by("-created_at")[:50]
        unread_count = Notificacion.objects.filter(usuario=request.user, leida=False).count()

        data = [
            {
                "id": str(n.id),
                "tipo": n.tipo,
                "animal_id": n.animal_id_str,
                "animal_anilla": n.animal_anilla,
                "mensaje": n.mensaje,
                "leida": n.leida,
                "created_at": n.created_at.isoformat(),
            }
            for n in nots
        ]

        # Virtual CUOTA_PENDIENTE alert (not stored in DB — always at top if applicable)
        try:
            socio = Socio.objects.filter(user=request.user).first()
            if socio:
                current_year = date.today().year
                cuota = socio.cuota_anual_pagada
                if cuota is None or cuota < current_year:
                    data.insert(0, {
                        "id": "cuota-pendiente",
                        "tipo": "CUOTA_PENDIENTE",
                        "animal_id": "",
                        "animal_anilla": "",
                        "mensaje": f"Tienes la cuota del año {current_year} pendiente de pago.",
                        "leida": False,
                        "created_at": f"{current_year}-01-01T00:00:00",
                    })
                    unread_count += 1
        except Exception:
            pass

        return Response({"count": unread_count, "results": data})


class NotificacionMarkReadView(APIView):
    """POST /api/v1/notificaciones/marcar-leidas/ — mark all as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import Notificacion
        Notificacion.objects.filter(usuario=request.user, leida=False).update(leida=True)
        return Response({"ok": True})


class NotificacionDeleteView(APIView):
    """DELETE /api/v1/notificaciones/<pk>/delete/ — permanently remove a notification."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        from .models import Notificacion
        try:
            n = Notificacion.objects.get(id=pk, usuario=request.user)
        except Notificacion.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        n.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Solicitudes de cambio de datos ────────────────────────────────────────────

_EDITABLE_FIELDS = {"telefono", "domicilio", "municipio", "codigo_postal", "provincia", "numero_cuenta", "codigo_rega", "email"}


def _notificar_cambio_datos(tenant, socio, accion):
    """Notifica al socio sobre la resolución de su solicitud de cambio de datos. Never raises."""
    try:
        if not socio or not getattr(socio, "user_id", None):
            return
        from .models import Notificacion
        if accion == "aprobar":
            tipo = "CAMBIO_DATOS_APROBADO"
            mensaje = "Tu solicitud de cambio de datos ha sido aprobada y aplicada."
        else:
            tipo = "CAMBIO_DATOS_DENEGADO"
            mensaje = "Tu solicitud de cambio de datos ha sido denegada."
        Notificacion.objects.create(
            tenant=tenant,
            usuario_id=socio.user_id,
            tipo=tipo,
            animal_id_str="",
            animal_anilla="",
            mensaje=mensaje,
        )
    except Exception:
        pass


def _socio_cambio_payload(socio):
    return {
        "id": str(socio.id),
        "socio_id": str(socio.id),
        "socio_nombre": socio.nombre_razon_social,
        "socio_numero": socio.numero_socio,
        "datos_actuales": {
            "telefono": socio.telefono,
            "domicilio": socio.domicilio,
            "municipio": socio.municipio,
            "codigo_postal": socio.codigo_postal,
            "provincia": socio.provincia,
            "numero_cuenta": socio.numero_cuenta,
            "codigo_rega": socio.codigo_rega,
            "email": socio.user.email if socio.user_id else "",
        },
    }


class SocioSolicitarCambioView(APIView):
    """POST /api/v1/socios/me/solicitar-cambio/ — socio solicita cambio de sus datos."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if get_effective_is_gestion(request):
            return Response({"detail": "Solo los socios pueden solicitar cambios."}, status=403)

        try:
            socio = request.user.socio
        except Exception:
            return Response({"detail": "No se encontró perfil de socio."}, status=400)

        datos = {k: v for k, v in request.data.items() if k in _EDITABLE_FIELDS}
        if not datos:
            return Response({"detail": "No se enviaron campos válidos para cambiar."}, status=400)

        from .models import SolicitudCambioDatos
        if SolicitudCambioDatos.objects.filter(socio=socio, estado=SolicitudCambioDatos.Estado.PENDIENTE).exists():
            return Response({"detail": "Ya tienes una solicitud de cambio de datos pendiente de revisión."}, status=400)

        solicitud = SolicitudCambioDatos.objects.create(
            tenant=request.tenant,
            socio=socio,
            datos_propuestos=datos,
        )
        return Response({
            "id": str(solicitud.id),
            "estado": solicitud.estado,
            "datos_propuestos": solicitud.datos_propuestos,
            "created_at": solicitud.created_at.isoformat(),
        }, status=201)


class SolicitudesCambioListView(APIView):
    """GET /api/v1/socios/solicitudes-cambio/ — gestión lista solicitudes pendientes."""
    permission_classes = [IsGestion]

    def get(self, request):
        from .models import SolicitudCambioDatos
        qs = SolicitudCambioDatos.objects.filter(
            tenant=request.tenant,
            estado=SolicitudCambioDatos.Estado.PENDIENTE,
        ).select_related("socio__user")

        results = []
        for s in qs:
            payload = _socio_cambio_payload(s.socio)
            payload.update({
                "id": str(s.id),
                "datos_propuestos": s.datos_propuestos,
                "estado": s.estado,
                "created_at": s.created_at.isoformat(),
            })
            results.append(payload)

        return Response({"count": len(results), "results": results})


class SolicitudCambioResolverView(APIView):
    """POST /api/v1/socios/solicitudes-cambio/:id/resolver/ — gestión aprueba o deniega."""
    permission_classes = [IsGestion]

    def post(self, request, pk):
        from .models import SolicitudCambioDatos
        try:
            solicitud = SolicitudCambioDatos.objects.select_related("socio__user").get(
                pk=pk, tenant=request.tenant
            )
        except SolicitudCambioDatos.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if solicitud.estado != SolicitudCambioDatos.Estado.PENDIENTE:
            return Response({"detail": "Esta solicitud ya fue resuelta."}, status=400)

        accion = request.data.get("accion")
        if accion not in ("aprobar", "denegar"):
            return Response({"detail": "accion debe ser 'aprobar' o 'denegar'."}, status=400)

        if accion == "aprobar":
            socio = solicitud.socio
            user_fields = []
            socio_fields = []
            for field, value in solicitud.datos_propuestos.items():
                if field == "email" and socio.user_id:
                    socio.user.email = value
                    user_fields.append("email")
                elif field in _EDITABLE_FIELDS - {"email"}:
                    setattr(socio, field, value)
                    socio_fields.append(field)
            if socio_fields:
                socio.save(update_fields=socio_fields)
            if user_fields:
                socio.user.save(update_fields=user_fields)
            solicitud.estado = SolicitudCambioDatos.Estado.APROBADO
        else:
            solicitud.estado = SolicitudCambioDatos.Estado.DENEGADO

        solicitud.save(update_fields=["estado"])
        _notificar_cambio_datos(request.tenant, solicitud.socio, accion)
        return Response({"ok": True, "estado": solicitud.estado})


class PropuestaMejoraView(APIView):
    """POST /api/v1/auth/propuesta-mejora/ — envía una propuesta de mejora a los superadmins."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        texto = (request.data.get("texto") or "").strip()
        if not texto:
            return Response({"detail": "El texto de la propuesta no puede estar vacío."}, status=400)
        if len(texto) > 2000:
            return Response({"detail": "El texto no puede superar los 2000 caracteres."}, status=400)

        tenant = request.tenant
        user = request.user

        # Construir información del remitente
        remitente_asociacion = tenant.name
        remitente_nombre = user.full_name or user.email
        remitente_email = user.email
        es_socio = not user.is_gestion

        if es_socio:
            try:
                socio = user.socio
                remitente_nombre = socio.nombre_razon_social
                if socio.numero_socio:
                    remitente_nombre += f" (Nº {socio.numero_socio})"
            except Exception:
                pass

        rol = "Socio" if es_socio else "Gestor"

        subject = f"Propuesta de Mejora — {remitente_asociacion}"
        body = (
            f"Se ha recibido una nueva propuesta de mejora desde la plataforma KRIA.\n\n"
            f"Asociación: {remitente_asociacion}\n"
            f"Remitente: {remitente_nombre}\n"
            f"Email: {remitente_email}\n"
            f"Rol: {rol}\n\n"
            f"{'─' * 50}\n\n"
            f"{texto}\n\n"
            f"{'─' * 50}\n\n"
            f"Puedes responder directamente a este email para contactar con el remitente."
        )

        try:
            emails = list(
                User.objects.filter(is_superadmin=True, is_active=True, notif_propuesta_mejora=True)
                .exclude(email="")
                .values_list("email", flat=True)
            )
            if emails:
                send_platform_mail(
                    subject=subject,
                    body=body,
                    recipient_list=emails,
                    tipo="NOTIF_PROPUESTA_MEJORA",
                    fail_silently=True,
                )
        except Exception:
            pass

        return Response({"detail": "Propuesta enviada. Gracias por tu feedback."}, status=200)
