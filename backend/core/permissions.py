"""
Custom DRF permissions for AGAMUR.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated


def get_effective_is_gestion(request):
    """
    Return True if the current request is operating in gestión mode.

    Reads the ``is_gestion`` claim from the JWT access token so that
    the dual-mode checkbox on the login form is respected:

    - admin logs in WITH checkbox  → JWT claim is_gestion=True  → gestión mode
    - admin logs in WITHOUT checkbox → JWT claim is_gestion=False → socio mode

    Falls back to the DB field only when there is no auth token (e.g. during
    unit tests that bypass JWT).
    """
    try:
        return bool(request.auth.get("is_gestion", False))
    except (AttributeError, TypeError):
        return bool(getattr(request.user, "is_gestion", False) or getattr(request.user, "is_superadmin", False))


class IsCurrentTenant(BasePermission):
    """Object belongs to the request's current tenant."""

    def has_object_permission(self, request, view, obj):
        tenant = getattr(request, "tenant", None)
        return tenant is not None and obj.tenant_id == tenant.id


class IsGestion(BasePermission):
    """User has gestión (staff) role within the tenant (respects JWT claim)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and get_effective_is_gestion(request)
        )


class IsSocio(BasePermission):
    """User is operating in socio mode (not gestión)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and not get_effective_is_gestion(request)
        )


class IsSocioOrGestion(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsSocioOwner(BasePermission):
    """
    Object-level: the authenticated socio must own the object
    (obj.socio_id == request.user.socio.id).
    Gestión users pass automatically (based on JWT claim).
    """

    def has_object_permission(self, request, view, obj):
        if get_effective_is_gestion(request):
            return True
        try:
            return obj.socio_id == request.user.socio.id
        except AttributeError:
            return False
