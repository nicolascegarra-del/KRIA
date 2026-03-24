# PLAN DE DESARROLLO — Kria
> Basado en auditoría del 2026-03-01

---

## Criterios de priorización

1. **Estabilidad de datos primero**: los bugs críticos detectados (scope de tenant, validaciones) se corrigen en Sprint 0.
2. **Funcionalidades de socio primero**: el socio es el usuario más numeroso y su experiencia bloquea la adopción.
3. **Los módulos inexistentes (Anillas, Documental) van después** de cerrar los parciales.
4. **Tests desde Sprint 1**: cada sprint añade tests para lo que construye.

---

## SPRINT 0 — Corrección de bugs críticos y cimientos (Semanas 1–2)

**Objetivo**: Que lo que ya funciona, funcione correctamente. Cero regresiones antes de añadir features.

### Backend — Corrección de bugs críticos

- [ ] **Bug #1**: Corregir `lotes/views.py` para usar `get_effective_is_gestion(request)` en lugar de `user.is_gestion` directamente.
  - Archivo: `backend/apps/lotes/views.py` — `LoteListCreateView.get_queryset()` y `perform_create()`

- [ ] **Bug #2**: Corregir `evaluaciones/views.py` para verificar que `animal.tenant == request.tenant` antes de guardar.
  - Archivo: `backend/apps/evaluaciones/views.py` — `EvaluacionListCreateView.perform_create()`

- [ ] **Bug #3**: Corregir `reproductores/views.py` para que el catálogo público filtre por tenant via header.
  - Archivo: `backend/apps/reproductores/views.py` — añadir resolución de tenant sin autenticación

- [ ] **Bug #4**: Corregir `DashboardTareasPendientesView` para filtrar `ImportJob` y `Conflicto` por `request.tenant`.
  - Archivo: `backend/apps/conflicts/views.py` — `DashboardTareasPendientesView.get()`

- [ ] **Bug #5**: Cambiar almacenamiento de fotos en Animal: guardar `key` de MinIO únicamente. Regenerar URL en tiempo de lectura en el serializer.
  - Archivos: `backend/apps/animals/views.py` (FotoUploadView), `backend/apps/animals/serializers.py`

- [ ] **Bug #6**: Añadir DRF throttling a endpoints costosos: upload de fotos, generación de reportes, importación Excel.
  - Archivo: `backend/config/settings/base.py` — `REST_FRAMEWORK.DEFAULT_THROTTLE_CLASSES`

### Backend — Validaciones de seguridad

- [ ] **Seguridad #1**: Validar tipo MIME real (magic bytes) en `AnimalFotoUploadView.post()` y en el futuro Gestor Documental. Añadir dependencia `python-magic`.
  - Archivo: `backend/apps/animals/views.py`

- [ ] **Seguridad #2**: Añadir dependencia `stdnum` y validador de DNI/NIF/NIE en `SocioSerializer`.
  - Archivo: `backend/apps/accounts/serializers.py`

### Infraestructura de tests

- [ ] Configurar `pytest-django` + `factory-boy` + `faker` en `requirements.txt` y `pytest.ini`.
- [ ] Crear `backend/conftest.py` con fixtures base: `tenant`, `socio_user`, `gestion_user`, `api_client`.
- [ ] Crear factories en `backend/factories.py`: `TenantFactory`, `UserFactory`, `SocioFactory`, `AnimalFactory`.

---

## SPRINT 1 — Animal: campos completos + validaciones (Semanas 3–4)

**Objetivo**: La ficha del animal cumple 100% de la spec del Libro Genealógico.

### Backend

- [ ] **Migración**: Añadir campos al modelo `Animal`:
  - `fecha_incubacion: DateField(null=True, blank=True)`
  - `ganaderia_nacimiento: CharField(max_length=200, blank=True)` — texto libre (nombre de la ganadería de origen)
  - `ganaderia_actual: CharField(max_length=200, blank=True)` — texto libre o FK a `Granja`
  - Archivo: `backend/apps/animals/models.py`, nueva migración `0004_add_ganaderia_incubacion.py`

- [ ] **Fotos tipadas**: Cambiar estructura JSON de fotos de `[{url, key}]` a `[{tipo, key, uploaded_at}]` donde `tipo ∈ {PERFIL, CABEZA, ANILLA}`.
  - Actualizar `AnimalFotoUploadView.post()` para recibir parámetro `tipo`.
  - Actualizar serializers para exponer URLs desde key en tiempo de lectura.

- [ ] **Validación 3 fotos obligatorias**: En `AnimalApproveView`, verificar que existen las 3 fotos tipadas antes de aprobar. Si faltan → 400 con mensaje específico.
  - Archivo: `backend/apps/animals/views.py`

- [ ] **Endpoint historial de pesajes**: `POST /api/v1/animals/:id/pesaje/` — añade `{fecha, peso, usuario}` al JSON `historico_pesos`.
  - Crear `AnimalPesajeView` en `backend/apps/animals/views.py` y añadir URL.

- [ ] **Búsqueda padre/madre por anilla**: Actualizar `AnimalWriteSerializer` para aceptar `padre_anilla + padre_anio` (en lugar de UUID) y resolver internamente.
  - Archivo: `backend/apps/animals/serializers.py`

- [ ] **Bloqueo de Variedad tras evaluación**: En `AnimalWriteSerializer.validate()`, si el animal tiene evaluación y el socio (no gestión) intenta cambiar `variedad` → lanzar ValidationError.

### Frontend

- [ ] **`AnimalFormPage`**: Añadir campos `fecha_incubacion`, `ganaderia_nacimiento`, `ganaderia_actual`.
- [ ] **`AnimalFormPage`**: Cambiar inputs padre/madre de UUID a buscador por anilla + año con debounce.
- [ ] **`AnimalFormPage`**: Cambiar upload de fotos para seleccionar tipo (Perfil / Cabeza / Anilla). Mostrar indicador visual de qué tipos faltan.
- [ ] **`AnimalFormPage`**: Añadir sección "Historial de Pesajes" con botón "Añadir pesaje" (fecha + peso).
- [ ] **Historial de bajas tab**: Añadir tab "Histórico de Bajas" en `MisAnimalesPage` (ya tiene la tab, verificar que filtre SOCIO_EN_BAJA correctamente).

### Tests

- [ ] `test_animal_state_machine.py`: revertir APROBADO→AÑADIDO al editar socio.
- [ ] `test_animal_fotos.py`: aprobar animal sin 3 fotos → 400; con 3 fotos OK.
- [ ] `test_animal_uid_unique.py`: anilla+año duplicada en mismo tenant → 400.
- [ ] `test_animal_variedad_lock.py`: socio no puede cambiar variedad tras evaluación.

---

## SPRINT 2 — Lotes de Cría + Frontend completo (Semanas 5–6)

**Objetivo**: Socios pueden gestionar sus lotes desde el móvil. Genealogía completa con lotes.

### Backend

- [ ] **Endpoint "madres posibles"**: `GET /api/v1/lotes/:id/hembras/` — lista las hembras del lote con datos básicos.
- [ ] **Serializer lote enriquecido**: incluir `macho_anilla`, lista de `hembras_anillas` y `crias_count`.
- [ ] **Árbol genealógico con lotes**: actualizar `_build_genealogy_node()` en `animals/serializers.py` para incluir el lote como nodo cuando `madre_animal=None` y `madre_lote` está presente.

### Frontend

- [ ] **Nueva página `LotesPage`** (`/mis-lotes`):
  - Lista de lotes del socio con estado (abierto/cerrado).
  - Modal crear lote: nombre, macho (buscador por anilla), hembras (multi-select por anilla), fecha inicio.
  - Botón "Finalizar lote" (llama a `POST /lotes/:id/close/`).
  - Vista de detalle: lista de crías vinculadas.

- [ ] **Actualizar `AnimalFormPage`**: selector "Madre (Lote)" como alternativa a "Madre (Animal)".

- [ ] **Actualizar `App.tsx`**: añadir ruta `/mis-lotes` con `ProtectedRoute socioOnly`.

- [ ] **`GenealogyTooltip`**: actualizar visualización D3 para mostrar nodos de lote diferenciados (color distinto, etiqueta "Lote X").

- [ ] **Tooltip on hover**: al hacer hover sobre anilla de padre/madre en el árbol, mostrar mini-card con foto miniatura, estado y nota de reproductor.

### Tests

- [ ] `test_lote_create.py`: crear lote con macho + 2 hembras.
- [ ] `test_lote_close.py`: finalizar lote → `is_closed=True`, fecha_fin registrada.
- [ ] `test_lote_genealogy.py`: animal con `madre_lote` → árbol muestra lote como madre posible.

---

## SPRINT 3 — Valoración Morfológica completa + Reproductores (Semanas 7–8)

**Objetivo**: El flujo técnico de evaluación y catálogo de reproductores es completo end-to-end.

### Backend

- [ ] **Migración**: Añadir campos de observación al modelo `Evaluacion`:
  - `picos_cresta: CharField(max_length=100, blank=True)`
  - `color_orejilla: CharField(max_length=100, blank=True)`
  - `color_general: CharField(max_length=100, blank=True)`
  - `peso_evaluacion: DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)`
  - `variedad_confirmada: CharField(choices=Variedad, null=True, blank=True)` — copia la variedad oficial del técnico
  - Archivo: `backend/apps/evaluaciones/models.py`, nueva migración

- [ ] **Signal post-save Evaluacion**: cuando `variedad_confirmada` se guarda, copiarla al campo `variedad` del animal.

- [ ] **Endpoint aprobación reproductor** (Gestión):
  - `POST /api/v1/animals/:id/aprobar-reproductor/` → `{ aprobado: true/false, notas_decision: "..." }`
  - Actualiza `reproductor_aprobado` en el modelo Animal.
  - Crear `AnimalReproductorView` en `backend/apps/animals/views.py`

- [ ] **Endpoint candidatos reproductores** (Gestión):
  - `GET /api/v1/reproductores/candidatos/` — lista animales con `candidato_reproductor=True` y `reproductor_aprobado=False`

- [ ] **Dashboard**: añadir contador `candidatos_reproductor` en `DashboardTareasPendientesView`.

### Frontend

- [ ] **`EvaluacionPage`**:
  - Cambiar input de animal UUID a buscador por anilla+año.
  - Añadir campos de observación (picos_cresta, color_orejilla, color_general, peso_evaluacion, variedad_confirmada).
  - **Selector 1–10 con código de colores**: botones grandes (no slider). 1-4 rojo, 5-6 amarillo, 7-8 verde, 9-10 dorado. Mínimo 48px de altura.
  - Preview de media aritmética en tiempo real (ya existe, mantener).
  - Validación: no guardar si algún campo 1–10 está vacío.

- [ ] **Nueva página `CandidatosReproductorPage`** (`/reproductores/candidatos`):
  - Lista de animales candidatos con fotos, anilla, puntuación media.
  - Botones Aprobar / Denegar con campo de notas.

- [ ] **Actualizar `App.tsx`**: añadir ruta `/reproductores/candidatos` con `ProtectedRoute gestionOnly`.

- [ ] **Actualizar `DashboardPage`**: añadir tile "Candidatos a Reproductor".

### Tests

- [ ] `test_evaluacion_fields.py`: guardar evaluación sin campo → 400; con todos los campos → 201, media calculada.
- [ ] `test_reproductor_workflow.py`: socio propone → gestión aprueba → aparece en catálogo.
- [ ] `test_variedad_lock_via_eval.py`: variedad_confirmada en evaluación → se copia al animal.

---

## SPRINT 4 — Control de Anillas (app nueva) (Semanas 9–10)

**Objetivo**: La Junta puede asignar rangos de anillas. El sistema valida automáticamente.

### Backend — Nueva app `anillas`

- [ ] **Crear app**: `python manage.py startapp anillas` en `backend/apps/anillas/`

- [ ] **Modelo `EntregaAnillas`**:
  ```python
  tenant, socio, anio_campana (PositiveSmallIntegerField),
  rango_inicio (CharField), rango_fin (CharField),
  diametro (choices: 18, 20), created_by, created_at
  ```

- [ ] **Validaciones en `AnimalWriteSerializer`**:
  - Al crear/editar un animal, verificar si la `numero_anilla` del animal está dentro de algún rango asignado a ese socio para ese año.
  - Si fuera de rango → añadir advertencia (no error bloqueante) en la respuesta.
  - Verificar que el diámetro del rango asignado corresponde al sexo del animal (18mm=Hembra, 20mm=Macho). Si no coincide → advertencia y bloquear transición a APROBADO.

- [ ] **Endpoints**:
  - `GET/POST /api/v1/anillas/` — listar/crear entregas (solo Gestión)
  - `GET/PUT/DELETE /api/v1/anillas/:id/`
  - `GET /api/v1/anillas/check/?anilla=X&anio=Y&socio_id=Z` — verificación puntual

- [ ] **Dashboard**: añadir contador `alertas_anilla` (animales con alerta de rango/diámetro pendiente) en `DashboardTareasPendientesView`.

### Frontend

- [ ] **Nueva página `AnillasPage`** (`/anillas`, Gestión):
  - Tabla de entregas por socio/año.
  - Formulario: seleccionar socio, año campaña, rango inicio/fin, diámetro.
  - Alerta visual si hay solapamiento de rangos.

- [ ] **`AnimalFormPage`**: mostrar aviso inline si la anilla está fuera del rango asignado o el diámetro no corresponde al sexo seleccionado.

- [ ] **`ValidacionesPage`**: mostrar badge de alerta de anilla en cada animal afectado.

### Tests

- [ ] `test_anilla_fuera_rango.py`: crear animal con anilla fuera del rango → alerta en respuesta.
- [ ] `test_anilla_diametro.py`: anilla 18mm asignada a macho → animal no puede pasar a APROBADO.
- [ ] `test_anilla_duplicada.py`: misma anilla + mismo año → 400 al guardar.

---

## SPRINT 5 — Re-altas + Panel Tareas Pendientes completo (Semanas 11–12)

**Objetivo**: El panel de Tareas Pendientes agrupa todos los flujos de revisión. Re-alta funcional.

### Backend

- [ ] **Modelo `SolicitudRealtas`**:
  - `animal, solicitante (Socio), estado (PENDIENTE/APROBADO/DENEGADO), notas, created_at`
  - App: ampliar `conflicts` o crear nueva app `solicitudes`

- [ ] **Endpoints re-alta**:
  - `POST /api/v1/animals/:id/solicitar-realta/` — socio solicita (solo si estado=SOCIO_EN_BAJA)
  - `POST /api/v1/solicitudes-realta/:id/resolver/` — gestión aprueba/deniega

- [ ] **Acción de aprobación re-alta**: cuando Gestión aprueba → animal.estado = AÑADIDO, exigir nuevas fotos.

- [ ] **Dashboard completo**: `DashboardTareasPendientesView` retorna todos los contadores:
  ```json
  {
    "pendientes_aprobacion": N,
    "conflictos_pendientes": N,
    "candidatos_reproductor": N,
    "solicitudes_realta": N,
    "alertas_anilla": N,
    "imports_pendientes": N
  }
  ```

- [ ] **Filtro de motivos de rechazo predefinidos**: crear enum o constantes con los motivos de rechazo por fase (Añadido / Aprobado / Evaluación). Exponer como endpoint `GET /api/v1/animals/motivos-rechazo/`.

### Frontend

- [ ] **`DashboardPage`**: actualizar tiles para mostrar los 6 contadores del spec.

- [ ] **`ValidacionesPage`**: añadir opción de que Gestión **edite datos** del animal antes de aprobar (inline form con campos editables + registro de trazabilidad del cambio).

- [ ] **Motivos de rechazo predefinidos**: en el modal de rechazo de `ValidacionesPage`, añadir selector con motivos predefinidos por fase + campo "Otros" libre.

- [ ] **Histórico de bajas en `MisAnimalesPage`**: añadir botón "Solicitar Re-alta" en cada animal con estado `SOCIO_EN_BAJA`. Mostrar estado de la solicitud.

- [ ] **Nueva sección en Dashboard o página propia `RealatasPage`**: lista de solicitudes de re-alta con Aprobar/Denegar.

### Tests

- [ ] `test_realta_flow.py`: animal en SOCIO_EN_BAJA → socio solicita → gestión aprueba → animal vuelve a AÑADIDO.
- [ ] `test_dashboard_counts.py`: verificar que los contadores del dashboard reflejan datos reales del tenant.

---

## SPRINT 6 — Gestor Documental (app nueva) (Semanas 13–14)

**Objetivo**: La Junta puede subir documentos generales e individuales por socio.

### Backend — Nueva app `documentos`

- [ ] **Crear app**: `python manage.py startapp documentos` en `backend/apps/documentos/`

- [ ] **Modelo `Documento`**:
  ```python
  tenant, tipo (GENERAL/PARTICULAR), socio (FK nullable — null=GENERAL),
  nombre_archivo, file_key (MinIO), content_type, tamanio_bytes,
  subido_por (User), created_at, version (PositiveIntegerField default=1)
  ```

- [ ] **Endpoints**:
  - `GET/POST /api/v1/documentos/general/` — Repositorio Junta (solo Gestión puede ver/subir)
  - `GET/POST /api/v1/documentos/socios/:socio_id/` — Buzón particular (Gestión sube, solo ese socio ve)
  - `DELETE /api/v1/documentos/:id/`
  - `GET /api/v1/documentos/:id/download/` — genera URL pre-firmada de descarga

- [ ] **Permisos**: `DocumentoParticular` — el socio solo puede ver documentos donde `socio == request.user.socio`. Gestión ve todos.

- [ ] **Validaciones**: máximo 20MB, tipos permitidos: PDF, JPG, PNG. Validar magic bytes.

- [ ] **Versiones**: si se sube un archivo con el mismo nombre, incrementar `version` y archivar el anterior (no borrar).

### Frontend

- [ ] **`SocioDetailPage`** (nueva página `/socios/:id`): ficha completa del socio con pestaña "Documentos" que muestra su buzón particular. Gestión puede subir/borrar documentos.

- [ ] **Nueva página `DocumentosPage`** (`/documentos`, Gestión):
  - Árbol de carpetas/archivos del repositorio general.
  - Upload con drag-and-drop.
  - Botón de descarga.

- [ ] **Panel socio**: en `MisAnimalesPage` o nuevo tab, el socio puede ver los documentos de su buzón particular (solo lectura, sin subir).

### Tests

- [ ] `test_documento_permisos.py`: socio_A no puede ver documentos de socio_B (403).
- [ ] `test_documento_gestion_only.py`: repositorio general invisible para socios (403).
- [ ] `test_documento_mime.py`: subir archivo con extensión .pdf pero contenido malicioso → 400.

---

## SPRINT 7 — Informes completos + Plantilla Excel (Semanas 15–16)

**Objetivo**: Todos los informes del spec funcionan, incluyendo la plantilla descargable.

### Backend

- [ ] **Plantilla Excel descargable**: endpoint `GET /api/v1/imports/template/` que devuelve un `.xlsx` con las columnas correctas y filas de ejemplo. Generado con openpyxl en memoria.

- [ ] **Marca de agua en PDFs**: actualizar templates HTML en `backend/templates/reports/` para incluir el logo del tenant como marca de agua SVG sobre-puesto. La spec dice "PDF con marca de agua de la asociación".

- [ ] **Ficha individual A4 completa**: actualizar `backend/templates/reports/individual.html` para incluir todos los campos: peso en evaluación, variedad confirmada, árbol genealógico 3 generaciones visual.

- [ ] **Árbol genealógico PDF 3 generaciones**: implementar en `backend/templates/reports/genealogy_cert.html` una visualización HTML/CSS del árbol pasando el objeto `tree` (ya serializado en el backend).

- [ ] **Catálogo PDF mejorado**: verificar que solo aparecen animales con `reproductor_aprobado=True` Y `estado=EVALUADO`. Actualizar filtro en `_gen_catalogo_reproductores()`.

- [ ] **Inventario con miniatura de foto**: actualizar `_gen_inventory_pdf()` para incluir la foto de tipo PERFIL en miniatura en la lista.

- [ ] **Libro Genealógico Excel**: añadir columnas de nuevos campos: fecha_incubacion, ganaderia_nacimiento, lote_madre.

- [ ] **Limpieza automática de ImportJob**: añadir Celery Beat task que borre los archivos de MinIO de jobs completados hace más de 30 días.

### Frontend

- [ ] **`ImportPage`**: añadir botón "Descargar plantilla Excel" que llame al nuevo endpoint.

- [ ] **`ReportesPage`**: añadir tile "Ficha Individual" (requiere seleccionar un animal) y "Certificado Genealógico".

- [ ] **`MisAnimalesPage`**: añadir botón "Descargar inventario PDF" y "Ficha PDF" por animal para el propio socio.

### Tests

- [ ] `test_report_generation.py`: generar cada tipo de informe → job completa sin error, URL de descarga válida.
- [ ] `test_catalogo_filtros.py`: solo animales `reproductor_aprobado=True` y `estado=EVALUADO` aparecen en el catálogo.

---

## SPRINT 8 — Súper Admin + Multi-tenant UI + Importación con preview (Semanas 17–18)

**Objetivo**: La plataforma es verdaderamente multi-tenant gestionable sin tocar el servidor.

### Backend

- [ ] **Endpoints Super Admin** (requieren `is_superadmin=True`):
  - `GET/POST /api/v1/superadmin/tenants/` — listar/crear asociaciones
  - `GET/PUT /api/v1/superadmin/tenants/:id/` — editar nombre, logo, colores
  - `POST /api/v1/superadmin/tenants/:id/logo/` — subir logo a MinIO, guardar URL
  - `POST /api/v1/superadmin/users/:id/reset-password/` — generar token y enviar email al usuario
  - `GET /api/v1/superadmin/stats/` — estadísticas globales (N tenants, N socios, N animales)

- [ ] **Importación con preview en 2 fases**:
  - **Fase 1** `POST /api/v1/socios/import/validate/` — sube el archivo, valida y devuelve resumen de errores SIN guardar nada. Guarda temporalmente en MinIO con TTL.
  - **Fase 2** `POST /api/v1/socios/import/confirm/` con `{temp_key: "..."}` — ejecuta el upsert real si el usuario confirma.

- [ ] **Permission `IsSuperAdmin`**: crear clase en `core/permissions.py`.

### Frontend

- [ ] **Nueva página `SuperAdminPage`** (solo accesible si `is_superadmin=True`):
  - Tabla de asociaciones con número de socios y animales.
  - Botón "Nueva Asociación" con formulario.
  - Por asociación: editar nombre, subir logo, cambiar colores primario/secundario.
  - Botón "Resetear contraseña" de cualquier usuario.

- [ ] **`ImportPage`**: implementar flujo de 2 fases:
  - Paso 1: subir Excel → mostrar tabla de preview con filas OK y filas con error resaltadas en rojo.
  - Paso 2: botón "Confirmar importación" solo si no hay errores críticos (o "Importar filas válidas" si hay errores no bloqueantes).

- [ ] **Actualizar `App.tsx`**: ruta `/superadmin` con guard `is_superadmin`.

### Tests

- [ ] `test_superadmin_tenant_crud.py`: crear/editar tenant vía API.
- [ ] `test_import_preview.py`: subir Excel con 2 errores → preview muestra errores, sin datos creados en BD.
- [ ] `test_import_confirm.py`: confirmar importación → datos creados/actualizados correctamente.

---

## SPRINT 9 — PWA mobile, UI polish y accesibilidad (Semanas 19–20)

**Objetivo**: La app es genuinamente usable desde un móvil Android/iOS.

### Frontend

- [ ] **Captura de cámara nativa**: en el upload de fotos de animal, añadir atributo `capture="environment"` al input de tipo file para que en móvil abra la cámara directamente.

- [ ] **Inputs táctiles mínimo 48px**: auditoría de toda la UI. Repasar botones en `AnimalCard`, modales, formularios.

- [ ] **Selector de valoración táctil**: en `EvaluacionPage`, reemplazar el `<input type="range">` por botones grandes (10 botones por campo) con código de color (1-4 rojo, 5-6 amarillo, 7-8 verde, 9-10 dorado). Mínimo 44px cada botón.

- [ ] **Colores de estado CSS vars inamovibles**: mover los colores de los estados del animal a variables CSS en `:root` que no sean sobreescritas por el branding del tenant.
  ```css
  --color-estado-añadido: #FBC02D;
  --color-estado-aprobado: #2E7D32;
  --color-estado-evaluado: #FFC107;
  --color-estado-rechazado: #D32F2F;
  --color-estado-baja: #9E9E9E;
  ```

- [ ] **Tipografía monoespaciada para anillas**: añadir `font-family: 'JetBrains Mono', monospace` a todos los elementos que muestran `numero_anilla`. Cargar la fuente desde Google Fonts o incluirla localmente.

- [ ] **Navegación Gestión — Sidebar completo**: verificar que el sidebar incluye todos los ítems del spec: Dashboard, Tareas Pendientes, Libro Genealógico (= Validaciones + Gestión de animales), Socios, Anillas, Gestor Documental.

- [ ] **Filiación cruzada**: en el buscador padre/madre del `AnimalFormPage`, cuando se busca un animal de otro socio, mostrar solo "Socio: [nombre]" sin revelar más datos.

- [ ] **Checkbox login solo para Gestión**: en `LoginPage`, el checkbox "Acceder como equipo de Gestión" solo debe mostrarse si el usuario tiene `is_gestion=True`. Antes del login, esto requiere o bien: (a) un endpoint que verifique si el email tiene rol gestión antes de mostrar el checkbox, o (b) mostrar siempre el checkbox y manejar el error de back.
  - Implementar opción (b): mostrar siempre, el backend devuelve 400 si el usuario no tiene gestión.
  - **Nota**: la spec dice "solo visible para gestión" — esto requiere un endpoint público previo o aceptar el comportamiento actual.

- [ ] **`OfflineIndicator`**: verificar funcionamiento de service worker y cache offline.

- [ ] **Soporte lector de pantalla**: añadir `aria-label` a botones de iconos (aprobación, rechazo, cámara, etc.).

---

## HITOS DE ENTREGA

| Hito | Sprint fin | Entregable |
|------|-----------|-----------|
| **Hotfix Bugs Críticos** | Sprint 0 | Sistema estable, sin bugs de scope entre tenants |
| **MVP Animal Completo** | Sprint 1 | Ficha de animal 100% del spec: campos, fotos tipadas, pesajes |
| **MVP Socio Funcional** | Sprint 2 | Socios pueden gestionar animales + lotes desde móvil |
| **MVP Técnico** | Sprint 3 | Evaluación morfológica completa + reproductores con workflow |
| **Beta Cerrada** | Sprint 5 | Anillas + Re-altas + Dashboard completo |
| **Beta Completa** | Sprint 6 | Gestor Documental funcional |
| **Release Candidate** | Sprint 7 | Todos los informes y exportaciones del spec |
| **v1.0 Producción** | Sprint 9 | Multi-tenant gestión UI + PWA mobile-first pulido |

---

## Estimación de esfuerzo

| Sprint | Funcionalidades | Complejidad |
|--------|----------------|-------------|
| 0 | Bug fixes + infra tests | Media |
| 1 | Animal completo | Alta |
| 2 | Lotes frontend | Media |
| 3 | Evaluación + Reproductores | Media |
| 4 | App Anillas (nueva) | Alta |
| 5 | Re-altas + Dashboard | Media |
| 6 | App Documentos (nueva) | Alta |
| 7 | Informes completos | Media |
| 8 | Super Admin + Import 2 fases | Alta |
| 9 | PWA + UI polish | Media |
