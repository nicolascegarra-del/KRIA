"""
SuperAdmin API — gestión de tenants y usuarios a nivel de plataforma.
Requiere is_superadmin=True en el User.
"""
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsSuperAdmin
from .models import Tenant
from .serializers import TenantSerializer, GestionUserCreateSerializer


class SuperAdminTenantListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/superadmin/tenants/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return Tenant.objects.exclude(slug="system").annotate(
            socios_count=Count("socios", filter=Q(socios__estado="ALTA"))
        ).order_by("name")

    def create(self, request, *args, **kwargs):
        gestion_user_data = request.data.get("gestion_user")

        # Validate gestion_user if provided
        gestion_serializer = None
        if gestion_user_data:
            gestion_serializer = GestionUserCreateSerializer(data=gestion_user_data)
            if not gestion_serializer.is_valid():
                return Response({"gestion_user": gestion_serializer.errors}, status=400)

        # Validate tenant data
        tenant_serializer = self.get_serializer(data=request.data)
        if not tenant_serializer.is_valid():
            return Response(tenant_serializer.errors, status=400)

        with transaction.atomic():
            tenant = tenant_serializer.save()

            if gestion_serializer:
                from apps.accounts.models import User
                gd = gestion_serializer.validated_data
                if User.objects.filter(email=gd["email"]).exists():
                    raise Exception(f"El email {gd['email']} ya está registrado en la plataforma.")
                u = User(
                    tenant=tenant,
                    email=gd["email"],
                    first_name=gd.get("first_name", ""),
                    last_name=gd.get("last_name", ""),
                    is_gestion=True,
                    is_active=True,
                )
                u.set_password(gd["password"])
                u.save()

        headers = self.get_success_headers(tenant_serializer.data)
        return Response(tenant_serializer.data, status=201, headers=headers)


class SuperAdminTenantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/PATCH/DELETE /api/v1/superadmin/tenants/:id/"""
    serializer_class = TenantSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Tenant.objects.all()


class SuperAdminTenantSuspendView(APIView):
    """POST /api/v1/superadmin/tenants/:id/suspend/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if tenant.slug == "system":
            return Response({"detail": "No se puede suspender el tenant del sistema."}, status=400)

        tenant.is_active = False
        tenant.save(update_fields=["is_active"])
        return Response(TenantSerializer(tenant).data)


class SuperAdminTenantActivateView(APIView):
    """POST /api/v1/superadmin/tenants/:id/activate/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        tenant.is_active = True
        tenant.save(update_fields=["is_active"])
        return Response(TenantSerializer(tenant).data)


class SuperAdminImpersonateView(APIView):
    """POST /api/v1/superadmin/tenants/:id/impersonate/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not tenant.is_active:
            return Response({"detail": "No se puede impersonar un tenant inactivo."}, status=400)

        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken()
        # Use the superadmin's user_id so IsSuperAdmin keeps working if needed
        token["user_id"] = str(request.user.id)
        token["tenant_id"] = str(tenant.id)
        token["tenant_slug"] = tenant.slug
        token["is_gestion"] = True
        token["is_superadmin"] = True
        token["impersonating"] = True
        token.set_exp(lifetime=__import__("datetime").timedelta(minutes=15))

        return Response({
            "access": str(token),
            "tenant": {
                "id": str(tenant.id),
                "name": tenant.name,
                "slug": tenant.slug,
            },
        })


class SuperAdminTenantLogoView(APIView):
    """POST /api/v1/superadmin/tenants/:id/logo/ — sube logo a MinIO y guarda URL."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        file = request.FILES.get("logo")
        if not file:
            return Response({"detail": "No file provided."}, status=400)

        try:
            from apps.reports.storage import upload_bytes, get_presigned_download_url
            key = f"tenants/{tenant.slug}/logo/{file.name}"
            upload_bytes(key, file.read(), file.content_type or "image/png")
            url = get_presigned_download_url(key, expiry_hours=24 * 365)
            tenant.logo_url = url
            tenant.save(update_fields=["logo_url"])
        except Exception as e:
            return Response({"detail": f"Error uploading logo: {str(e)}"}, status=500)

        return Response(TenantSerializer(tenant).data)


class SuperAdminTenantUsersView(APIView):
    """GET/POST /api/v1/superadmin/tenants/:id/users/ — listar y crear usuarios de gestión."""
    permission_classes = [IsSuperAdmin]

    def get(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        users = User.objects.filter(tenant=tenant, is_gestion=True).order_by("email")
        return Response(UserSerializer(users, many=True).data)

    def post(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        gestion_serializer = GestionUserCreateSerializer(data=request.data)
        if not gestion_serializer.is_valid():
            return Response(gestion_serializer.errors, status=400)

        gd = gestion_serializer.validated_data
        if User.objects.filter(email=gd["email"]).exists():
            return Response({"detail": f"El email {gd['email']} ya está registrado en la plataforma."}, status=400)

        user = User(
            tenant=tenant,
            email=gd["email"],
            first_name=gd.get("first_name", ""),
            last_name=gd.get("last_name", ""),
            is_gestion=True,
            is_active=True,
        )
        user.set_password(gd["password"])
        user.save()
        return Response(UserSerializer(user).data, status=201)


class SuperAdminUserDetailView(APIView):
    """PATCH/DELETE /api/v1/superadmin/users/:id/"""
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            user = User.objects.get(pk=pk, is_gestion=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        allowed = {"first_name", "last_name", "email"}
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])

        if "password" in request.data and request.data["password"]:
            user.set_password(request.data["password"])

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        from apps.accounts.models import User
        try:
            user = User.objects.get(pk=pk, is_gestion=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # Prevent deleting the last active gestión user of a tenant
        remaining = User.objects.filter(tenant=user.tenant, is_gestion=True, is_active=True).exclude(pk=pk).count()
        if remaining == 0:
            return Response({"detail": "No se puede eliminar el último usuario de gestión activo."}, status=400)

        user.delete()
        return Response(status=204)


class SuperAdminUserSuspendView(APIView):
    """POST /api/v1/superadmin/users/:id/suspend/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            user = User.objects.get(pk=pk, is_gestion=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user).data)


class SuperAdminUserActivateView(APIView):
    """POST /api/v1/superadmin/users/:id/activate/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            user = User.objects.get(pk=pk, is_gestion=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user).data)


class SuperAdminUserResetPasswordView(APIView):
    """POST /api/v1/superadmin/users/:id/reset-password/ — genera token y lo devuelve."""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from apps.accounts.models import User
        import uuid
        from django.utils import timezone

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        token = uuid.uuid4()
        user.reset_token = token
        user.reset_token_created = timezone.now()
        user.save(update_fields=["reset_token", "reset_token_created"])

        return Response({
            "user_id": str(user.id),
            "email": user.email,
            "reset_token": str(token),
        })


class SuperAdminAdminUsersListView(APIView):
    """GET /api/v1/superadmin/admin-users/ — lista global de usuarios de gestión."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        users = (
            User.objects
            .filter(is_gestion=True, is_superadmin=False)
            .select_related("tenant")
            .order_by("tenant__name", "email")
        )
        data = []
        for u in users:
            d = UserSerializer(u).data
            d["tenant_name"] = u.tenant.name
            d["tenant_id"] = str(u.tenant_id)
            data.append(d)
        return Response(data)


class SuperAdminSuperAdminListCreateView(APIView):
    """GET/POST /api/v1/superadmin/superadmins/ — gestión de usuarios superadmin."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        users = User.objects.filter(is_superadmin=True).order_by("email")
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        from apps.tenants.models import Tenant

        email = request.data.get("email", "").strip()
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        password = request.data.get("password", "")

        if not email:
            return Response({"detail": "Email es obligatorio."}, status=400)
        if not password or len(password) < 8:
            return Response({"detail": "La contraseña debe tener al menos 8 caracteres."}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({"detail": f"El email {email} ya está registrado."}, status=400)

        system_tenant, _ = Tenant.objects.get_or_create(
            slug="system",
            defaults={"name": "System", "is_active": True, "max_socios": 0},
        )
        user = User(
            tenant=system_tenant,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_gestion=True,
            is_superadmin=True,
            is_staff=True,
            is_superuser=True,
            is_active=True,
        )
        user.set_password(password)
        user.save()
        return Response(UserSerializer(user).data, status=201)


class SuperAdminSuperAdminDetailView(APIView):
    """PATCH/DELETE /api/v1/superadmin/superadmins/:id/"""
    permission_classes = [IsSuperAdmin]

    def patch(self, request, pk):
        from apps.accounts.models import User
        from apps.accounts.serializers import UserSerializer
        try:
            user = User.objects.get(pk=pk, is_superadmin=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        for field in ("first_name", "last_name", "email"):
            if field in request.data:
                setattr(user, field, request.data[field])

        if request.data.get("password"):
            if len(request.data["password"]) < 8:
                return Response({"detail": "La contraseña debe tener al menos 8 caracteres."}, status=400)
            user.set_password(request.data["password"])

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        from apps.accounts.models import User
        try:
            user = User.objects.get(pk=pk, is_superadmin=True)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        user.delete()
        return Response(status=204)


class SuperAdminStatsView(APIView):
    """GET /api/v1/superadmin/stats/ — estadísticas globales + por asociación."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from apps.accounts.models import User, Socio
        from apps.animals.models import Animal

        # Estadísticas globales
        global_stats = {
            "tenants": Tenant.objects.exclude(slug="system").count(),
            "usuarios": User.objects.filter(is_gestion=True, is_superadmin=False).count(),
            "socios": Socio.all_objects.filter(estado="ALTA").count(),
            "animales": Animal.all_objects.count(),
        }

        # Estadísticas por asociación (excluye tenant de sistema)
        tenants_stats = (
            Tenant.objects
            .exclude(slug="system")
            .annotate(socios_count=Count("socios", filter=Q(socios__estado="ALTA")))
            .order_by("name")
            .values("id", "name", "slug", "is_active", "max_socios", "socios_count")
        )

        return Response({
            **global_stats,
            "por_asociacion": list(tenants_stats),
        })


# ── Helpers SMTP ──────────────────────────────────────────────────────────────

def _test_smtp_connection(host, port, user, password, use_tls, use_ssl):
    import smtplib
    import ssl as ssl_module
    if not host:
        return Response({"detail": "No hay configuración SMTP guardada."}, status=400)
    try:
        if use_ssl:
            context = ssl_module.create_default_context()
            with smtplib.SMTP_SSL(host, int(port), context=context, timeout=10) as server:
                if user:
                    server.login(user, password)
        else:
            with smtplib.SMTP(host, int(port), timeout=10) as server:
                if use_tls:
                    server.starttls()
                if user:
                    server.login(user, password)
        return Response({"detail": "Conexión SMTP exitosa."})
    except smtplib.SMTPAuthenticationError:
        return Response({"detail": "Error de autenticación. Comprueba usuario y contraseña."}, status=400)
    except Exception as e:
        return Response({"detail": f"Error de conexión: {str(e)}"}, status=400)


# ── Platform Settings (singleton SMTP global) ─────────────────────────────────

class PlatformSettingsView(APIView):
    """GET/PATCH /api/v1/superadmin/settings/"""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from .models import PlatformSettings
        from .serializers import PlatformSettingsSerializer
        return Response(PlatformSettingsSerializer(PlatformSettings.get()).data)

    def patch(self, request):
        from .models import PlatformSettings
        from .serializers import PlatformSettingsSerializer
        settings = PlatformSettings.get()
        s = PlatformSettingsSerializer(settings, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            return Response(s.data)
        return Response(s.errors, status=400)


class PlatformSmtpTestView(APIView):
    """POST /api/v1/superadmin/settings/test-smtp/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        from .models import PlatformSettings
        cfg = PlatformSettings.get()
        return _test_smtp_connection(cfg.smtp_host, cfg.smtp_port, cfg.smtp_user,
                                     cfg.smtp_password, cfg.smtp_use_tls, cfg.smtp_use_ssl)


class TenantSmtpTestView(APIView):
    """POST /api/v1/superadmin/tenants/:id/test-smtp/"""
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        return _test_smtp_connection(tenant.smtp_host, tenant.smtp_port, tenant.smtp_user,
                                     tenant.smtp_password, tenant.smtp_use_tls, tenant.smtp_use_ssl)


class SuperAdminTenantDeleteSociosView(APIView):
    """POST /api/v1/superadmin/tenants/:id/delete-socios/
    Elimina todos los socios (y sus animales en cascada) de una asociación.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from apps.accounts.models import Socio, User
        try:
            tenant = Tenant.objects.exclude(slug="system").get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        socios_qs = Socio.all_objects.filter(tenant=tenant)
        count = socios_qs.count()

        # IDs de usuarios normales (no gestión) para borrar tras eliminar los socios
        user_ids = list(
            socios_qs.exclude(user__is_gestion=True)
                     .exclude(user__is_superadmin=True)
                     .values_list("user_id", flat=True)
        )

        # Eliminar socios → CASCADE elimina animales, evaluaciones, etc.
        socios_qs.delete()

        # Eliminar cuentas de usuario normales que ya no tienen socio
        User.objects.filter(id__in=user_ids, is_gestion=False, is_superadmin=False).delete()

        return Response({"detail": f"Se han eliminado {count} socios.", "count": count})
