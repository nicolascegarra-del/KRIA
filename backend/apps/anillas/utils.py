"""
Lógica de validación de anillas: rango y diámetro.
"""

# Mapping diámetro → sexo por defecto (usado solo si el tenant no tiene config)
_DEFAULT_DIAMETRO_SEXO = {"18": "H", "20": "M"}


def _to_int(value):
    """Intenta convertir a entero; devuelve None si no es posible."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _get_diametro_sexo(tenant_id) -> dict:
    """Devuelve el mapping diámetro→sexo configurado para el tenant.
    Si el tenant no tiene anilla_sizes o algún tamaño no tiene sexo, usa los defaults."""
    try:
        from apps.tenants.models import Tenant
        tenant = Tenant.objects.only("anilla_sizes").get(pk=tenant_id)
        sizes = tenant.anilla_sizes or []
        mapping = {sz["mm"]: sz["sexo"] for sz in sizes if sz.get("mm") and sz.get("sexo")}
        if mapping:
            return mapping
    except Exception:
        pass
    return _DEFAULT_DIAMETRO_SEXO


def _anilla_in_rango(numero_anilla: str, rango_inicio: str, rango_fin: str) -> bool:
    """
    Comprueba si `numero_anilla` está dentro del rango [rango_inicio, rango_fin].
    Usa comparación entera si los tres valores son numéricos,
    o lexicográfica en caso contrario.
    """
    anilla_n = _to_int(numero_anilla)
    inicio_n = _to_int(rango_inicio)
    fin_n = _to_int(rango_fin)

    if anilla_n is not None and inicio_n is not None and fin_n is not None:
        return inicio_n <= anilla_n <= fin_n
    # Lexicographic fallback
    return rango_inicio <= numero_anilla <= rango_fin


def compute_alerta_anilla(numero_anilla: str, anio: int, sexo: str, socio_id, tenant_id) -> str:
    """
    Calcula la alerta de anilla para un animal.

    Returns:
        ""              — sin alerta
        "FUERA_RANGO"   — anilla fuera del rango asignado al socio (advertencia, no bloquea)
        "DIAMETRO"      — diámetro del rango no corresponde al sexo (bloquea APROBADO)
    """
    from apps.anillas.models import EntregaAnillas

    entregas = list(
        EntregaAnillas.all_objects.filter(
            tenant_id=tenant_id,
            socio_id=socio_id,
            anio_campana=anio,
        )
    )

    if not entregas:
        # Sin rangos asignados para esta campaña → sin alerta
        return ""

    diametro_sexo = _get_diametro_sexo(tenant_id)

    for entrega in entregas:
        if _anilla_in_rango(numero_anilla, entrega.rango_inicio, entrega.rango_fin):
            # Anilla encontrada en el rango — verificar diámetro
            expected_sexo = diametro_sexo.get(entrega.diametro)
            if expected_sexo and expected_sexo != sexo:
                return "DIAMETRO"
            return ""  # Todo correcto

    return "FUERA_RANGO"
