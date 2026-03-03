"""
Custom DRF throttle classes for expensive endpoints.
"""
from rest_framework.throttling import UserRateThrottle


class UploadRateThrottle(UserRateThrottle):
    """
    Applies to: photo upload, Excel import, report generation.
    Rate: 20 requests/minute per authenticated user.
    """
    scope = "uploads"
