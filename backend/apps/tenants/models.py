import uuid

from django.db import models


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    logo_url = models.URLField(blank=True, default="")
    primary_color = models.CharField(max_length=7, default="#1565C0")   # hex
    secondary_color = models.CharField(max_length=7, default="#FBC02D")
    custom_domain = models.CharField(max_length=200, blank=True, default="", db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenants_tenant"
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"

    def __str__(self):
        return self.name
