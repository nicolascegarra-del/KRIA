# INFORME DE AUDITORÍA — Kria
> Generado: 2026-03-01

---

## Stack Tecnológico Detectado

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Backend** | Django + Django REST Framework | 5.1.6 / 3.15.2 |
| **Autenticación** | djangorestframework-simplejwt | 5.3.1 |
| **Base de Datos** | PostgreSQL (vía dj-database-url + psycopg2) | - |
| **ORM** | Django ORM nativo | - |
| **Cola de tareas** | Celery + Redis | 5.4.0 / 5.2.1 |
| **Almacenamiento** | MinIO (S3-compatible) vía minio + boto3 | 7.2.11 |
| **PDF** | WeasyPrint | 62.3 |
| **Excel** | openpyxl + pandas | 3.1.5 / 2.2.3 |
| **Gráficos radar** | matplotlib | 3.10.0 |
| **Frontend** | React 18 + TypeScript + Vite | 18.3.1 / 5.5.4 / 5.4.7 |
| **Estado UI** | Zustand + React Query (TanStack) | 5.0.0 / 5.56.2 |
| **Estilos** | Tailwind CSS | 3.4.12 |
| **Formularios** | react-hook-form | 7.53.0 |
| **Visualización** | D3.js | 7.9.0 |
| **PWA** | vite-plugin-pwa | 0.20.5 |
| **Routing** | React Router DOM | 6.26.2 |
| **Infraestructura** | Docker Compose + Nginx (SSL) + Gunicorn | - |
| **CI/CD** | GitHub Actions + script de deploy SSH | - |

### Valoración del Stack

El stack elegido es **completamente adecuado** para los requisitos. Django + DRF + Celery cubre multi-tenancy, generación asíncrona de PDFs/Excel y workers en background. React + Vite + vite-plugin-pwa cubre el requisito PWA/mobile-first. MinIO S3-compatible garantiza almacenamiento escalable de fotos y documentos. No se recomienda cambio de arquitectura.

---

## Estado por Módulo

| Módulo | Estado | % Estimado | Pendiente principal |
|--------|--------|-----------|---------------------|
| **Arquitectura Multi-tenant** | ✅ Completo | 95% | Tests |
| **Autenticación / Login Dual** | ✅ Completo | 90% | Validación DNI/NIF en login |
| **Recuperación de Contraseña** | ✅ Completo | 95% | Tests de expiración |
| **Gestión de Socios (CRUD)** | ✅ Completo | 85% | Buzón documental, validación DNI |
| **Baja de Socio** | ✅ Completo | 90% | Motivos predefinidos en UI |
| **Importación Masiva Excel** | 🟡 Parcial | 65% | Preview de errores antes de confirmar; descarga plantilla |
| **Libro Genealógico (Animal CRUD)** | 🟡 Parcial | 70% | Campos faltantes, validación 3 fotos, genealogía por anilla |
| **Sistema de Semáforos** | ✅ Completo | 90% | Tests; motivos de rechazo estructurados en UI |
| **Control de Anillas** | ❌ No iniciado | 0% | Modelo, validaciones, alertas, toda la app |
| **Lotes de Cría** | 🟡 Parcial | 55% | Sin página frontend; tooltip genealógico básico |
| **Valoración Morfológica** | 🟡 Parcial | 60% | Campos extra de observación; selector táctil con colores |
| **Reproductores / Catálogo** | 🟡 Parcial | 50% | Página de gestión (aprobar/denegar candidatos); workflow completo |
| **Traspasos y Re-altas** | 🟡 Parcial | 60% | Lógica backend OK; re-alta (resurrección) no implementada |
| **Panel de Tareas Pendientes** | 🟡 Parcial | 45% | Solo 3 contadores; faltan: candidatos reproductor, re-altas, alertas anilla, bajas pendientes |
| **Gestor Documental** | ❌ No iniciado | 0% | Repositorio general + buzón particular por socio |
| **Informes PDF** | 🟡 Parcial | 70% | Templates HTML existen; sin marca de agua funcional; sin ficha A4 con peso evaluación |
| **Informes Excel (Libro Genealógico)** | ✅ Completo | 85% | Formato ARCA personalizable |
| **Catálogo Reproductores PDF** | ✅ Completo | 80% | Radar chart implementado; necesita workflow de aprobación |
| **Multi-tenant / Marca Blanca** | ✅ Completo | 85% | Panel Super Admin para gestión de asociaciones |
| **PWA / Responsive** | 🟡 Parcial | 70% | Configuración presente; captura de cámara básica; sin captura directa nativa `capture="environment"` |
| **Súper Admin** | 🟡 Parcial | 30% | Solo seed_admin; sin panel UI para gestionar múltiples tenants |
| **Tests** | ❌ No iniciado | 0% | Cero archivos de test |

---

## Análisis Detallado por Módulo

### A. Lo que FUNCIONA correctamente

#### Multi-tenant
- `TenantMiddleware` resuelve tenant por: subdominio (`slug.kria.es`) → header `X-Tenant-Slug` → dominio custom.
- `TenantManager` filtra automáticamente todos los querysets al tenant activo.
- El JWT embebe `tenant_id`, `tenant_slug`, `is_gestion` para resolver el modo dual en cada request.

#### Autenticación
- Login dual: el campo `access_as_gestion` en el body del login controla el claim JWT.
- Si un socio intenta `access_as_gestion=true` sin el permiso → el serializer lanza 400.
- Token de recuperación de contraseña: UUID + timestamp, se invalida tras uso (`reset_token=None`).
- `seed_admin` crea tenant demo + usuario gestión + usuario socio al arrancar.

#### Semáforos de animales
- Signal `pre_save` revierte APROBADO/EVALUADO → AÑADIDO cuando edita un socio.
- Signal `post_save` en Evaluacion → automáticamente pasa el animal a EVALUADO.
- Signal `post_save` en Socio (estado BAJA) → encola Celery task `freeze_animals_for_socio`.
- La task filtra todos los animales del socio y los pasa a `SOCIO_EN_BAJA` con `.update()` eficiente.

#### Conflictos de titularidad
- Lógica de "registro inteligente" en `AnimalListCreateView.create()` implementa los 4 escenarios:
  - Animal nuevo → crea.
  - Mismo socio → actualiza.
  - Socio propietario en BAJA → transfiere (limpia fotos, reinicia a AÑADIDO).
  - Socio propietario en ALTA → crea `Conflicto` y devuelve 409.
- Frontend (`ConflictosPage`) permite resolver/descartar con notas.

#### Informes
- 5 tipos de informes via Celery: Inventario PDF, Ficha Individual PDF, Certificado Genealógico PDF, Libro Genealógico Excel, Catálogo Reproductores PDF.
- Catálogo: 1 página por animal con gráfico radar matplotlib en base64.
- Libro Excel: formato con estilos, columnas autoajustadas, compatible ARCA.
- Templates HTML para WeasyPrint presentes en `backend/templates/reports/`.
- Sistema de `ReportJob` con polling de estado desde el frontend.

---

### B. Lo que está INCOMPLETO o tiene GAPS

#### Animal — Campos faltantes del modelo
```
Spec exige:          Estado actual:
fecha_incubacion     ❌ No existe en el modelo
ganaderia_nacimiento ❌ No existe (distinto de `granja` actual)
ganaderia_actual     ❌ No existe
```
- Las fotos se almacenan como JSON libre `[{url, key, uploaded_at}]` sin tipos.
  La spec exige 3 tipos obligatorios: **Perfil / Cabeza / Anilla**. No hay validación de que existan los 3 antes de cambiar de estado.
- El campo `historico_pesos` existe en el modelo como JSON, pero **no hay endpoint** `POST /animals/:id/pesos/` para añadir pesajes.
- La genealogía en el formulario pide UUID del padre/madre. La spec dice introducir el **número de anilla** manualmente con búsqueda posterior.
- La **Variedad de Color** no se bloquea tras una evaluación. No hay lógica que impida que el socio la cambie después.

#### Importación Excel — Preview de errores
El proceso actual es: subir → Celery procesa → resultado disponible vía polling.
La spec exige un **paso previo de validación**: mostrar los errores al usuario y que confirme explícitamente antes de ejecutar el upsert. No está implementado.
Tampoco existe el endpoint para descargar la plantilla Excel con las columnas.

#### Lotes de Cría — Sin frontend
Backend completo (modelo `Lote`, `LoteHembra`, views, serializer, URL).
**No existe ninguna página de frontend** para que el socio cree, vea o gestione sus lotes.

#### Valoración Morfológica — Campos de observación faltantes
La spec define estos campos adicionales que **no están en el modelo**:
```
picos_cresta          (texto)
color_orejilla        (texto)
color_general         (texto)
peso_evaluacion       (decimal)
variedad_confirmada   (SALMON / PLATA — confirmada por técnico)
```
Tampoco implementa el **selector táctil 1–10 con colores** (1-4 rojo, 5-6 amarillo, 7-8 verde, 9-10 dorado). La UI actual usa un `<input type="range">` sin codificación de color.

#### Reproductores — Flujo de aprobación por Gestión
El modelo tiene `candidato_reproductor` y `reproductor_aprobado` pero:
- No hay **endpoint `POST /animals/:id/aprobar-reproductor/`** para que Gestión apruebe/deniegue.
- No hay **página de gestión** que liste los candidatos con botón de aprobación.
- La app `reproductores` solo expone el catálogo público (AllowAny).

#### Re-alta (Resurrección)
- El botón "Solicitar Re-alta" en la pestaña Histórico de Bajas **no existe**.
- No hay flujo de aprobación por Gestión en Tareas Pendientes.

#### Control de Anillas — App completa inexistente
Requisito: la Junta registra rangos de anillas (Nº Inicio – Nº Fin, Año campaña, Diámetro).
El sistema debe:
- Alertar si la anilla usada está fuera del rango asignado al socio.
- Bloquear duplicados (anilla + año).
- Alertar si el diámetro no corresponde al sexo (18mm Hembra / 20mm Macho).

**No existe nada de esto**: ni modelo, ni app Django, ni frontend.

#### Gestor Documental — App completa inexistente
Requisito:
- Repositorio general para la Junta (actas, normativas, ARCA). Invisible para socios.
- Buzón particular: Gestión sube PDFs/imágenes a la ficha de un socio. Solo ese socio los ve.
- Control de versiones básico (quién subió qué y cuándo).

**No existe**: ni modelo, ni vistas, ni frontend.

#### Súper Admin — Panel de gestión multi-tenant
Solo existe `seed_admin` para crear el primer tenant/admin.
Faltan:
- Panel de gestión de múltiples asociaciones (crear/activar/desactivar tenants).
- Subida/actualización de logo y colores de marca desde la UI.
- Resetear credenciales de usuarios desde el panel Super Admin.

---

## Deuda Técnica Detectada

### Crítica (puede causar bugs en producción)

1. **`lotes/views.py` usa `user.is_gestion` directamente** en lugar de `get_effective_is_gestion(request)`. Esto rompe el modo dual — un usuario gestion que haya hecho login sin el checkbox verá los lotes de todos los socios.

2. **`evaluaciones/views.py` usa `user.is_gestion` implícitamente** vía la permission `IsGestion`, pero no pasa el tenant al crear evaluaciones — el serializer no lo valida. El `perform_create` no verifica que el animal pertenezca al tenant activo.

3. **`reproductores/views.py` filtra `reproductor_aprobado=True` sin tenant scope** — el `TenantManager` aplica filtro automático, pero al usar `Animal.objects.filter()` sin `tenant=request.tenant` explícito, depende del middleware. Si se llama sin header X-Tenant-Slug devuelve animales de todos los tenants.

4. **Fotos almacenadas como URLs pre-firmadas con expiración de 8760h (1 año)** en el JSON. Al regenerar los informes PDF un año después, las URLs habrán expirado. Se deberían almacenar las `keys` de MinIO y generar URLs en tiempo de lectura.

5. **`ImportJob` guarda el archivo en MinIO pero nunca lo borra** tras procesar. Acumulará archivos indefinidamente.

6. **Sin rate-limiting en ningún endpoint API** (Nginx tiene `limit_req` solo para `/api/v1/auth`). Los endpoints de upload y report generation no tienen throttling en DRF.

### Media (degradación de experiencia)

7. **`AnimalFormPage` input de padre/madre pide UUID directamente**. Los socios no conocen UUIDs internos. Debe buscar por número de anilla.

8. **El `DashboardTareasPendientesView` no filtra por tenant correctamente** — usa `Animal.objects.filter(estado=...)` que sí usa TenantManager, pero `ImportJob` y `Conflicto` también deben usar el manager filtrado por tenant. Actualmente podrían mostrar counts entre-tenant en entornos multi-asociación reales.

9. **La genealogía del certificado solo llega a 3 generaciones** de forma correcta en backend, pero el árbol D3 en frontend (`GenealogyTooltip`) es básico y no muestra lotes como "madres posibles".

10. **No hay validación de tipo MIME real en uploads de fotos** — solo `accept="image/*"` en el HTML. El backend acepta cualquier `content_type` sin verificar el magic bytes del archivo.

11. **El frontend de `ValidacionesPage` no permite a Gestión editar datos antes de aprobar** (la spec dice que Gestión puede corregir datos con trazabilidad antes de aprobar). Solo tiene botones Aprobar/Rechazar.

### Baja (mejoras de calidad)

12. **Sin paginación real en la mayoría de las páginas** — `MisAnimalesPage` carga todos los animales del socio en una sola request y filtra por tab en el frontend.

13. **El formulario de evaluación en `EvaluacionPage` solicita el ID del animal como texto libre**. Debería ser un buscador por número de anilla.

14. **La spec define colores inamovibles para estados** (`#FBC02D`, `#2E7D32`, etc.). `AnimalStateChip` usa clases Tailwind que podrían sobreescribirse por el tema del tenant. Los colores de estado deberían estar en CSS variables separadas del branding.

---

## Dependencias Faltantes (para módulos pendientes)

Para implementar los módulos faltantes se necesitan estas librerías adicionales:

```
# Validación de DNI/NIF español
stdnum==1.20          # python-stdnum para validar DNI/NIF/NIE

# Gestor Documental — tipos MIME reales
python-magic==0.4.27  # validación magic bytes en uploads

# Control de anillas — sin dependencias extra (modelo Django puro)

# Tests
pytest-django==4.9.0
pytest-cov==6.0.0
factory-boy==3.3.1    # factories para datos de test
faker==33.0.0
```

Frontend:
```
# Para exportación de plantilla Excel descargable en el cliente
# (backend puede generarla, no se necesita librería frontend adicional)
```
