"""
TenantMiddleware — resolves the active tenant for each request.

Resolution order:
  1. Custom domain                  → Tenant.custom_domain
  2. Subdomain: <slug>.kria.es    → Tenant.slug
  3. Header:    X-Tenant-Slug      → Tenant.slug  (legacy / local dev)
  4. JWT Bearer token              → tenant_id claim (no slug required)
"""
import logging

from django.conf import settings
from django.http import JsonResponse

from apps.tenants.models import Tenant
from core.managers import clear_current_tenant, set_current_tenant

logger = logging.getLogger(__name__)

SUFFIX = getattr(settings, "TENANT_DOMAIN_SUFFIX", ".kria.es")

# Paths that do NOT require a tenant (public health/admin)
TENANT_EXEMPT_PATHS = [
    "/health/",
    "/admin/",
    "/static/",
]


_EXPIRED_TOKEN = object()  # sentinel: token present but couldn't be decoded


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Always clear first
        clear_current_tenant()

        if self._is_exempt(request.path):
            return self.get_response(request)

        tenant = self._resolve_tenant(request)

        # Bearer token was present but expired/invalid — return 401 so the
        # client's refresh interceptor can obtain a new access token.
        if tenant is _EXPIRED_TOKEN:
            return JsonResponse(
                {"detail": "Authentication credentials expired."},
                status=401,
            )

        if tenant is None:
            # Allow public endpoints (branding, token obtain) even without tenant
            # for the login flow the tenant slug must be sent via header
            if self._requires_tenant(request.path):
                return JsonResponse(
                    {"detail": "Tenant not found. Send X-Tenant-Slug header."},
                    status=400,
                )
            return self.get_response(request)

        if not tenant.is_active:
            return JsonResponse({"detail": "Tenant is inactive."}, status=403)

        set_current_tenant(tenant)
        request.tenant = tenant
        response = self.get_response(request)
        clear_current_tenant()
        return response

    # ── helpers ──────────────────────────────────────────────────────────────

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(p) for p in TENANT_EXEMPT_PATHS)

    def _requires_tenant(self, path: str) -> bool:
        """All /api/v1/ paths except a few public ones require tenant."""
        PUBLIC_API = [
            "/api/v1/tenants/current/branding/",
            "/api/v1/auth/login/",
            "/api/v1/auth/password-reset/",
            "/api/v1/auth/token/refresh/",
        ]
        if not path.startswith("/api/v1/"):
            return False
        return not any(path.startswith(p) for p in PUBLIC_API)

    def _resolve_tenant(self, request) -> "Tenant | None":
        host = request.get_host().split(":")[0].lower()

        # 1. Custom domain
        try:
            tenant = Tenant.objects.get(custom_domain=host, is_active=True)
            return tenant
        except Tenant.DoesNotExist:
            pass

        # 2. Subdomain pattern  slug.kria.es
        if SUFFIX and host.endswith(SUFFIX):
            slug = host[: -len(SUFFIX)]
            if slug:
                try:
                    return Tenant.objects.get(slug=slug, is_active=True)
                except Tenant.DoesNotExist:
                    pass

        # 3. Header fallback (legacy / dev)
        slug = request.headers.get("X-Tenant-Slug", "").strip().lower()
        if slug:
            try:
                return Tenant.objects.get(slug=slug, is_active=True)
            except Tenant.DoesNotExist:
                pass

        # 4. JWT Bearer token — extract tenant_id claim
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token_str = auth_header[7:]
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                token = AccessToken(token_str)
                tenant_id = token.get("tenant_id")
                if tenant_id:
                    try:
                        # Do NOT filter by is_active here — let the is_active
                        # check below return a proper 403 for suspended tenants.
                        return Tenant.objects.get(id=tenant_id)
                    except Tenant.DoesNotExist:
                        pass
            except Exception:
                # Token present but expired or invalid — signal caller to return 401
                # so the client's refresh interceptor can obtain a new token.
                return _EXPIRED_TOKEN

        return None
