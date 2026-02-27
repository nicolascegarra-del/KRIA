"""
Custom DRF permissions for AGAMUR.
"""
from rest_framework.permissions import BasePermission, IsAuthenticated


class IsCurrentTenant(BasePermission):
    """Object belongs to the request's current tenant."""

    def has_object_permission(self, request, view, obj):
        tenant = getattr(request, "tenant", None)
        return tenant is not None and obj.tenant_id == tenant.id


class IsGestion(BasePermission):
    """User has gestión (staff) role within the tenant."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and (request.user.is_gestion or request.user.is_superadmin)
        )


class IsSocio(BasePermission):
    """User is a regular socio (not gestión)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and not request.user.is_gestion
        )


class IsSocioOrGestion(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsSocioOwner(BasePermission):
    """
    Object-level: the authenticated socio must own the object
    (obj.socio_id == request.user.socio.id).
    Gestión users pass automatically.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_gestion or user.is_superadmin:
            return True
        try:
            return obj.socio_id == user.socio.id
        except AttributeError:
            return False
