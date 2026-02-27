"""
Celery tasks for PDF and Excel report generation.
"""
import logging
import traceback
import uuid

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def _update_job(job, status, file_key="", error=""):
    job.status = status
    job.file_key = file_key
    job.error_log = error
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "file_key", "error_log", "finished_at"])


@shared_task(name="reports.generate_report", queue="reports", bind=True, max_retries=0)
def generate_report(self, job_id: str):
    from .models import ReportJob
    try:
        job = ReportJob.all_objects.select_related("tenant", "created_by").get(pk=job_id)
    except ReportJob.DoesNotExist:
        return

    job.status = ReportJob.Status.PROCESSING
    job.save(update_fields=["status"])

    try:
        rt = job.report_type
        if rt == ReportJob.ReportType.INVENTORY:
            file_key = _gen_inventory_pdf(job)
        elif rt == ReportJob.ReportType.INDIVIDUAL:
            file_key = _gen_individual_pdf(job)
        elif rt == ReportJob.ReportType.GENEALOGY_CERT:
            file_key = _gen_genealogy_cert(job)
        elif rt == ReportJob.ReportType.LIBRO_GENEALOGICO:
            file_key = _gen_libro_genealogico(job)
        elif rt == ReportJob.ReportType.CATALOGO_REPRODUCTORES:
            file_key = _gen_catalogo_reproductores(job)
        else:
            raise ValueError(f"Unknown report type: {rt}")

        _update_job(job, ReportJob.Status.DONE, file_key=file_key)

    except Exception:
        _update_job(job, ReportJob.Status.FAILED, error=traceback.format_exc())


# ── PDF generators ────────────────────────────────────────────────────────────

def _render_pdf(template_name: str, context: dict) -> bytes:
    from django.template.loader import render_to_string
    from weasyprint import HTML, CSS  # type: ignore
    html_string = render_to_string(template_name, context)
    return HTML(string=html_string).write_pdf()


def _gen_inventory_pdf(job) -> str:
    from apps.animals.models import Animal
    from apps.accounts.models import Socio

    socio_id = job.params.get("socio_id")
    if socio_id:
        animals = Animal.all_objects.filter(
            tenant=job.tenant, socio_id=socio_id
        ).select_related("socio")
    else:
        animals = Animal.objects.filter(tenant=job.tenant).select_related("socio")

    context = {
        "tenant": job.tenant,
        "animals": animals,
        "title": "Inventario de Animales",
        "watermark": "COPIA",
    }
    pdf_bytes = _render_pdf("reports/inventory.html", context)
    key = f"reports/{job.tenant.slug}/inventory/{uuid.uuid4()}.pdf"
    from .storage import upload_bytes
    return upload_bytes(key, pdf_bytes, "application/pdf")


def _gen_individual_pdf(job) -> str:
    from apps.animals.models import Animal

    animal_id = job.params.get("animal_id")
    animal = Animal.all_objects.select_related(
        "socio", "padre", "madre_animal", "evaluacion"
    ).get(pk=animal_id, tenant=job.tenant)

    context = {"tenant": job.tenant, "animal": animal, "watermark": "COPIA"}
    pdf_bytes = _render_pdf("reports/individual.html", context)
    key = f"reports/{job.tenant.slug}/individual/{animal_id}.pdf"
    from .storage import upload_bytes
    return upload_bytes(key, pdf_bytes, "application/pdf")


def _gen_genealogy_cert(job) -> str:
    from apps.animals.models import Animal
    from apps.animals.serializers import _build_genealogy_node

    animal_id = job.params.get("animal_id")
    animal = Animal.all_objects.select_related(
        "padre", "padre__padre", "padre__madre_animal",
        "madre_animal", "madre_animal__padre", "madre_animal__madre_animal",
    ).get(pk=animal_id, tenant=job.tenant)

    tree = _build_genealogy_node(animal, max_depth=3)
    context = {"tenant": job.tenant, "animal": animal, "tree": tree, "watermark": "CERTIFICADO"}
    pdf_bytes = _render_pdf("reports/genealogy_cert.html", context)
    key = f"reports/{job.tenant.slug}/genealogy/{animal_id}.pdf"
    from .storage import upload_bytes
    return upload_bytes(key, pdf_bytes, "application/pdf")


def _gen_libro_genealogico(job) -> str:
    """
    Generate ARCA/Ministerio format Excel Libro Genealógico using openpyxl.
    Fixed column schema: Anilla | Año | Sexo | Variedad | Padre | Madre | Socio | NIF | REGA | Estado | Puntuación
    """
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    import io
    from apps.animals.models import Animal

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Libro Genealógico"

    HEADERS = [
        "Nº Anilla", "Año Nac.", "Sexo", "Variedad",
        "Padre (Anilla)", "Madre (Anilla)", "Socio", "DNI/NIF", "Cód. REGA",
        "Estado", "Puntuación Media",
    ]

    header_fill = PatternFill(start_color="1565C0", end_color="1565C0", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")

    for col, header in enumerate(HEADERS, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    animals = Animal.all_objects.filter(tenant=job.tenant).select_related(
        "socio", "padre", "madre_animal"
    ).prefetch_related("evaluacion").order_by("variedad", "numero_anilla")

    for row_num, animal in enumerate(animals, 2):
        try:
            media = float(animal.evaluacion.puntuacion_media)
        except Exception:
            media = ""

        ws.append([
            animal.numero_anilla,
            animal.anio_nacimiento,
            animal.get_sexo_display(),
            animal.get_variedad_display(),
            animal.padre.numero_anilla if animal.padre else "",
            animal.madre_animal.numero_anilla if animal.madre_animal else "",
            animal.socio.nombre_razon_social,
            animal.socio.dni_nif,
            animal.socio.codigo_rega,
            animal.get_estado_display(),
            media,
        ])

    # Auto-fit columns
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

    buf = io.BytesIO()
    wb.save(buf)
    excel_bytes = buf.getvalue()

    key = f"reports/{job.tenant.slug}/libro-genealogico/{uuid.uuid4()}.xlsx"
    from .storage import upload_bytes
    return upload_bytes(key, excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def _gen_catalogo_reproductores(job) -> str:
    """
    Generate Catálogo Reproductores PDF: 1 page per animal, with radar chart.
    """
    from apps.animals.models import Animal
    import io, base64

    animals = Animal.all_objects.filter(
        tenant=job.tenant, reproductor_aprobado=True
    ).select_related("socio").prefetch_related("evaluacion").order_by("variedad", "numero_anilla")

    pages = []
    for animal in animals:
        radar_b64 = ""
        try:
            ev = animal.evaluacion
            radar_b64 = _generate_radar_chart(ev)
        except Exception:
            pass
        pages.append({"animal": animal, "radar_b64": radar_b64})

    context = {"tenant": job.tenant, "pages": pages}
    pdf_bytes = _render_pdf("reports/catalogo_reproductores.html", context)
    key = f"reports/{job.tenant.slug}/catalogo/{uuid.uuid4()}.pdf"
    from .storage import upload_bytes
    return upload_bytes(key, pdf_bytes, "application/pdf")


def _generate_radar_chart(evaluacion) -> str:
    """Generate a base64-encoded radar/spider chart PNG using matplotlib."""
    import io, base64
    import numpy as np
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    categories = ["Cabeza", "Cola", "Pecho/Abd.", "Muslos/Tarsos", "Cresta/Babilla", "Color"]
    values = [
        evaluacion.cabeza, evaluacion.cola, evaluacion.pecho_abdomen,
        evaluacion.muslos_tarsos, evaluacion.cresta_babilla, evaluacion.color,
    ]

    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]
    values_plot = values + values[:1]

    fig, ax = plt.subplots(figsize=(4, 4), subplot_kw=dict(polar=True))
    ax.plot(angles, values_plot, "o-", linewidth=2, color="#1565C0")
    ax.fill(angles, values_plot, alpha=0.25, color="#1565C0")
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, size=9)
    ax.set_ylim(0, 10)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(["2", "4", "6", "8", "10"], size=7)
    ax.set_title(f"Puntuación media: {evaluacion.puntuacion_media}", size=10, pad=15)

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=120, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("utf-8")
