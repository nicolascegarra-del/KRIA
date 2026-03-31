from django.db import migrations


def update_old_default_colors(apps, schema_editor):
    """
    Update tenants that still have the old default colors (#1565C0 / #FBC02D)
    to the new Klyp brand palette (#051937 / #2E6DB4).
    """
    Tenant = apps.get_model("tenants", "Tenant")
    Tenant.objects.filter(primary_color="#1565C0").update(primary_color="#051937")
    Tenant.objects.filter(secondary_color="#FBC02D").update(secondary_color="#2E6DB4")


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0007_tenant_address_contact_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tenant",
            name="primary_color",
            field=__import__("django.db.models", fromlist=["CharField"]).CharField(
                max_length=7, default="#051937"
            ),
        ),
        migrations.AlterField(
            model_name="tenant",
            name="secondary_color",
            field=__import__("django.db.models", fromlist=["CharField"]).CharField(
                max_length=7, default="#2E6DB4"
            ),
        ),
        migrations.RunPython(update_old_default_colors, migrations.RunPython.noop),
    ]
