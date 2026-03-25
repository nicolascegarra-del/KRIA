# AGAMUR Frontend — UX Review Comprehensivo (2026-03-14)

## Resumen Ejecutivo

**Puntuación General: 7.5/10**

AGAMUR es una aplicación bien estructurada con 3 roles (GESTIÓN, SOCIO, SUPERADMIN) y navegación clara. Los flujos principales funcionan, pero existen **problemas de UX críticos** en:

1. **Validez de datos sin feedback visual claro** (SuperAdminPage, SociosPage)
2. **Ausencia de confirmaciones antes de acciones destructivas** en ciertos flujos
3. **Modales sin scroll management** en formularios largos (AnimalFormPage)
4. **Inkonsistensi en patrones de error handling** entre páginas
5. **Missing loading states** en algunos flujos asincronos críticos

La arquitectura base es sólida (React Query, React Hook Form, Tailwind), pero la **implementación UX es inconsistente**. A continuación, análisis detallado.

---

## 1. UX por Rol

### GESTIÓN (Desktop-First)
**Puntuación: 7.2/10**

#### Fortalezas
- Dashboard con 6 contadores principales (tiles) + quick actions bien organizados — buena información scannability (DashboardPage:72-137)
- Validaciones: flujo explícito (approbar/rechazar) con modales confirmación + textarea de razón (ValidacionesPage:119-159)
- Importación en 3 fases con previsualización y validación previa (ImportPage phases bien separadas)

#### Problemas Graves
1. **SociosPage SocioModal:** No hay feedback visual claro cuando el request fallide
   - Línea 177-180: `{serverError && <div>...` → El error aparece pero **no desaparece automáticamente**
   - Usuario ve error antiguo después de guardar exitosamente
   - **FIX CRÍTICO:** Implementar auto-dismiss (3-5s) o limpiar error al cambiar input

2. **SuperAdminPage:** Formulario inline sin estructura clara
   - Línea 79-117: Form dentro de un card con border violet muy comprimido
   - Color picker (línea 92-93) ocupa espacio horizontal innecesario
   - Slug field deshabilitado en edit (línea 87) — pero esto es correctamente comunicado
   - **Mejora:** Usar modal en lugar de inline form para crear/editar tenants

3. **ValidacionesPage:** Approve/reject botones muy pequeños
   - Línea 93-111: Botones `p-2 rounded-lg` son táctiles pero icono-only
   - En hover no hay clear feedback que sean clickeables
   - **FIX:** Añadir `title` attribute o tooltip (ya tienen `title` — bien)

### SOCIO (Mobile-First)
**Puntuación: 7.8/10**

#### Fortalezas
- **MisAnimalesPage:** Tabs + búsqueda + estado filter combinados bien (líneas 56-103)
- **AnimalFormPage:** Foto upload con 3 tipos (PERFIL, CABEZA, ANILLA) → UX clara con checkmarks (líneas 510-591)
- Historias genealógicas + pesajes → Información contextual sin abrumar (líneas 595-671)

#### Problemas Graves
1. **AnimalFormPage:** Form masivo sin scroll boundaries
   - Línea 227: `max-w-2xl space-y-4` → en dispositivos <1024px, el form ocupa toda pantalla
   - Secciones separadas (Identificación, Genealogía, Fotos) pero **sin sticky header o progreso visual**
   - Usuario no sabe si ha scrolleado a la mitad o al final
   - **FIX:** Implementar step indicator o sticky section tabs

2. **MisAnimalesPage "Solicitar re-alta":** Botón muy pequeño
   - Línea 136-147: Texto y icono muy pequeños para acción importante
   - No hay confirmación antes de mutate (línea 137)
   - **FIX:** Modal de confirmación con `setRealtaId` antes de `mutate()`

3. **MisLotesPage:** Modal de creación puede ser abrumador
   - LoteModal línea 94-174: 5 secciones diferentes sin indicación de progreso
   - Resolución de anillas (línea 26-51) es **sincrónica pero parece bloqueada**
   - Usuario no sabe si el app está esperando respuesta o si input es incorrecto
   - **FIX:** Loading state durante anilla resolution + error messages inline

### SUPERADMIN (Power User)
**Puntuación: 7.0/10**

#### Problemas
- SuperAdminPage: Form inline ocupa demasiado espacio sin necesidad
- Tabla de tenants simple pero sin paginación/búsqueda (línea 129-160)
- No hay "confirmar antes de cambiar is_active" — estado crítico

---

## 2. Flujos Críticos Análisis Detallado

### A. Login (LoginPage)
**Puntuación: 8/10 — Bien implementado**

✅ **Fortalezas:**
- Tenant slug input con debounce (línea 54) + loading spinner
- Branding dinámico por tenant (línea 70-89)
- Confirmación visual cuando slug es válido (línea 112-114)
- Dual-mode checkbox explícito (línea 150-158)

⚠️ **Mejoras Menores:**
- Error message "Credenciales incorrectas" genérico (línea 65) — no distingue entre invalid_email vs. invalid_password vs. tenant_not_found
- Password reset link debería ser más prominente (línea 182-187)

---

### B. Registrar Animal (AnimalFormPage)
**Puntuación: 6.5/10 — Problemas UX Graves**

**Flujo:**
1. Acceso a `/mis-animales/nuevo` → Form vacío
2. LLena datos (13 campos distribuidos en 5 secciones)
3. Click "Registrar animal" → Redirect a `/mis-animales/{id}` en edit mode
4. Luego puede subir fotos

**Problemas:**
1. **No hay indicación visual de secciones obligatorias vs. opcionales**
   - Línea 261-282: Identificación (NULLA, ANIO) — ok están marcadas `required`
   - Línea 286-303: Biología (SEXO) — ✓ required. Variedad — no marcado `required` pero default="SALMON"
   - Línea 307-337: Datos de Cría — **todas opcionales** pero no hay visual indicator (gris, disabled, etc.)
   - **FIX:** Usar asterisco rojo solo en required fields, gris muted text para opcionales

2. **Foto upload UX en edit mode es separada del form principal**
   - Línea 500-592: `{isEdit && <div className="card space-y-3">...}`
   - Usuario NO puede subir fotos al crear — debe esperar redirect + reload
   - Esto crea fricción: "¿por qué no puedo subir ahora?"
   - **FIX:** Cambiar flujo: crear animal primero (sin fotos), redirect, LUEGO mostrar foto upload con mensaje "3 fotos requeridas"

3. **Genealogía "madre mode" toggle es confusa**
   - Línea 364-426: Radio buttons `Individual` vs. `Lote de Cría` pero...
   - Si user selecciona `Lote de Cría` pero lotesData está loading (línea 76-79), select aparecerá vacío sin explicación
   - **FIX:** Mostrar `Cargando lotes...` mientras `enabled: madreMode === "lote"` && `isLoading`

4. **Error handling es disperso**
   - Línea 41-42, 149-166: `conflictError` vs `serverError` — ¿por qué 2 estados?
   - Conflicto muestra en línea 452-455, otros errores línea 458-461
   - User no sabe si puede reintentar o si es problema permanente
   - **FIX:** Unificar a `errors: Error[]` con timestamps y retry button

5. **GenealogyTooltip carga lenta**
   - Línea 65-68: `enabled: isEdit && showGenealogia` → click del botón (línea 485-490) triggea query
   - Si genealogy es grande (muchos ancestros), UI se congela esperando render
   - **FIX:** Implementar virtualization o mostrar loading spinner mientras genealogy carga

---

### C. Validar Animal (ValidacionesPage)
**Puntuación: 8/10 — Bien, pero falta polish**

✅ **Fortalezas:**
- Flujo claro: lista → approve/reject inline
- Error message específico cuando approve falla (línea 33-35): "Comprueba que tiene las 3 fotos obligatorias"
- Reject modal con textarea (línea 120-159): buena UX de confirmación

⚠️ **Problemas:**
1. **Approve error persiste hasta siguiente acción**
   - Línea 14, 86-89: `approveErrors[animal.id]` mostrado en rojo
   - Usuario approva → 400 error → error mostrado → usuario ve otro animal → vuelve al primero → error aún visible (potencialmente outdated)
   - **FIX:** Auto-dismiss error después de 5s O permitir close button en error alert

2. **No hay "está cargando..." visual durante approve**
   - Línea 23: `setApprovingId(id)` pero UI solo cambia spinner en botón (línea 99-102)
   - Resto de UI sigue interactive — user podría clickear múltiples animales simultaneously
   - **FIX:** Implementar "disabled overlay" en la tarjeta mientras `approvingId !== null`

---

### D. Subir Documento (DocumentosPage)
**Puntuación: 8.5/10 — Bueno**

✅ **Fortalezas:**
- Upload drag-n-drop visual clara (línea 69-73)
- File list con versioning + tamaño + fecha (línea 93-101)
- Delete con confirm() (línea 106) — simple pero efectivo

⚠️ **Problemas Menores:**
1. Upload error no desaparece automáticamente (línea 76-80)
2. Downloading state en botón is ok (línea 103-105) pero no hay cancel option

---

### E. Importar Socios (ImportPage)
**Puntuación: 8/10 — Excelente progresión de fases**

✅ **Fortalezas:**
- 3-phase UX clara: upload → preview → processing
- Preview muestra summary (total, OK, errores) + tabla con primeras 50 filas (línea 163-227)
- Error log accesible después de failure (línea 310-313)
- Job polling inteligente (línea 33-36): `refetchInterval` cambia según status

⚠️ **Problemas:**
1. **Preview table sin sticky header en desktop**
   - Línea 197-227: `<table>` en scrollable div
   - Si hay 50 filas, header desaparece al scroll
   - **FIX:** `<thead className="sticky top-0 bg-white">` en `<table>`

2. **Fase 3 (processing) no tiene cancel option**
   - Si user inicia import y quiere cancelar, no hay forma (salvo cerrar tab)
   - **FIX:** Implementar cancel endpoint en backend + UI button "Cancelar importación" (solo si PENDING/PROCESSING)

---

### F. Generar Reportes (ReportesPage)
**Puntuación: 7.5/10 — Funcional pero feedback podría mejorar**

✅ **Fortalezas:**
- 3 tipos de reportes con descripciones claras (línea 19-41)
- Job status polling con iconos visuales (línea 92-99): Clock (PENDING), Loader (PROCESSING), Check (DONE), X (FAILED)
- Download link generado en tiempo real (línea 115-124)

⚠️ **Problemas:**
1. **ReportJobStatus es muy minimalist**
   - Línea 91-130: Solo muestra status + download link
   - Si job tarda >30s, user no sabe si está progresando o stuck
   - **FIX:** Mostrar "Tiempo transcurrido" o estimación

2. **Generating buttons no tienen disabled state coherente**
   - Línea 70-80: Button muestra spinner durante request initial (línea 46-50)
   - Pero después el job está PENDING/PROCESSING en el servidor — UI permite clickear nuevamente (múltiples jobs para mismo report)
   - **FIX:** Mantener `disabled` state hasta que job.status === DONE|FAILED

---

### G. Candidatos Reproductor (CandidatosReproductorPage)
**Puntuación: 8/10 — UX clara, pero expand interaction es redundante**

✅ **Fortalezas:**
- Tarjeta expandible (ChevronDown/Up) muestra datos adicionales + notas textarea + botones (línea 116-169)
- Botones "Aprobar" (emerald) vs "Denegar" (red) son visuales distintos (línea 145-161)
- Notas textarea es optional (línea 128-141)

⚠️ **Problemas:**
1. **Expand pattern requiere 2 clicks: chevron + botón action**
   - Usuario debe expandir → esperar re-render → scroll → click action
   - **FIX:** Permitir quick approve/deny desde tarjeta collapse (botones inline al lado del chevron) + modal para notas solo si user quiere agregar

2. **Multiple action IDs state complexity**
   - Línea 12: `const [actionId, setActionId] = useState<string | null>(null)`
   - Línea 29-32: Solo puede pendingить 1 animal a la vez
   - Si user clickea "Aprobar A" y luego "Negar B" muy rápido, UI se confunde
   - **FIX:** Usar `isPending` del mutation en lugar de `actionId` check

---

### H. Solicitudes Re-alta (SolicitudesRealtaPage)
**Puntuación: 7.5/10 — Similar a Candidatos, menos finalmente**

Similar pattern a CandidatosReproductorPage pero con menos datos (solo solicitante + animal + notas). Los problemas son similares.

---

## 3. Feedback Visual & Loading States

### Overall: 6.8/10 — Inconsistente

**Bien implementado:**
- Skeleton loaders: AnimalesPage (línea 62-64), SociosPage (línea 254-256), DashboardPage (línea 91-96)
- Spinner en botones submit: Ubiquos + claro
- Error alerts: Consistentemente rojo con AlertCircle icon

**Problemas:**

| Página | Problema | Línea | Severidad |
|--------|----------|-------|-----------|
| SociosPage | Server errors no auto-dismiss | 177-180 | 🔴 CRÍTICO |
| SuperAdminPage | Form errors no auto-dismiss | 108 | 🔴 CRÍTICO |
| ValidacionesPage | Approve error persiste | 86-89 | 🟡 IMPORTANTE |
| ImportPage | Preview table sin sticky header | 197-227 | 🟡 IMPORTANTE |
| AnimalFormPage | Genealogy query sin loading visual | 65-69 | 🟡 IMPORTANTE |
| DocumentosPage | Upload error no auto-dismiss | 76-80 | 🟡 IMPORTANTE |
| ReportesPage | No cancel option para jobs | N/A | 🟡 IMPORTANTE |

---

## 4. Consistencia & Brand

### Nomenclatura
✅ **Bien:**
- Botones: "Iniciar sesión", "Guardar cambios", "Rechazar", "Confirmar" — lenguaje consistente
- Estados: "AÑADIDO", "APROBADO", "EVALUADO", "RECHAZADO", "SOCIO_EN_BAJA" — mapeo claro a colores

❌ **Inconsistencias:**
- "Crear Socio" vs "Crear Asociación" — verbos diferentes, pero similar flujo
- "Aprobar como reproductor" (largo) vs "Confirmar Baja" (corto) — inconsistencia en longitud

### Iconografía
✅ **Bien:**
- Lucide icons usados coherentemente (Bird, Users, CheckSquare, etc.)
- Tamaño consistente: `size={16}` en botones, `size={20}` en headers
- Color del icon sigue el botón (línea 30-31 DashboardPage)

### Colores
✅ **Bien:**
- Primary: `#1565C0` (blue-800) desde branding
- Danger: `bg-red-700` consistente
- Success: `bg-green-700|600` consistente
- Variedad states: Amarillo (AÑADIDO), Verde (APROBADO), Rojo (RECHAZADO) — buena semántica (AnimalStateChip:4-10)

### Tailwind Components
✅ **Bien:**
- `.card`: border + shadow + padding consistente (index.css:59-61)
- `.btn-primary` / `.btn-secondary` / `.btn-danger`: estados disabled + hover coherentes (index.css:33-50)
- `.input-field`: min-height de 48px (index.css:52-57) — bueno para mobile

❌ **Problemas:**
- Algunas páginas usan inline `style={}` en lugar de Tailwind (línea 92 LoginPage `style={{ background: primaryColor }}`)
- SuperAdminPage color picker (línea 92-93) usa `h-10 w-16` hardcoded en lugar de utility class

---

## 5. Accesibilidad (WCAG AA Gaps)

### ✅ Bien Implementado
- Touch targets mínimo 44x44px (index.css:19-21)
- Form labels `<label htmlFor>` patterns (parcialmente — see issues below)
- Aria-labels en botones icon-only (línea 97, 108 ValidacionesPage)

### ❌ Problemas Críticos (WCAG AA Falla)

| Problema | Ubicación | Impacto |
|----------|-----------|--------|
| **No aria-live en error messages** | SociosPage:177, SuperAdminPage:108 | Screen reader no anuncia error |
| **Modal sin focus trap** | RejectModal (ValidacionesPage:120-159) | Tab key escapa del modal |
| **Modales sin role="dialog"** | Varias páginas | Screen reader no comunica que es modal |
| **Table headers sin scope="col"** | ImportPage:197-227 | Screen reader no sabe headers |
| **Checkbox sin label association** | AnimalFormPage:443-449 | Pequeño target, potencialmente confuso |
| **Expandible sections sin role="button"** | CandidatosReproductorPage:107-113 | Screen reader no comunica collapsible |
| **Color picker accessibility** | SuperAdminPage:92-93 | No keyboard support para `<input type="color">` |

---

## 6. Performance Perception

### Query Strategies
✅ **Bien:**
- Dashboard refetchInterval: 30000 (DashboardPage:23) — no spam backend
- Import job polling: 2000ms mientras PENDING|PROCESSING (ImportPage:35) — smart
- Tenants list sin refetch interval — sensato (data no cambia frecuentemente)

❌ **Problemas:**
- **SociosPage:** Search input no debounced → queryKey depende de input directo (línea 210-211)
  - User tipos "john" rápido → 5 requests (j, jo, joh, john + acciones intermedias)
  - **FIX:** `const debouncedSearch = useDebounce(search, 500)`

- **AnimalFormPage genealogy:** Carga lazy cuando showGenealogia=true pero sin loading state
  - Línea 65-68: Si tree es grande, UI freezes
  - **FIX:** Mostrar skeleton mientras genealogy loads

---

## 7. Problemas Graves (DEBE ARREGLARSE)

### 🔴 Crítico (Bloquea Usuario o Causa Fricción Alta)

#### 1. Error Messages No Auto-Dismiss
**Ubicación:** SociosPage:177-180, SuperAdminPage:108
**Problema:** Usuario guarda → error → usuario reload página → vuelve a ver error old (UI state no sincronizado)
**Solución:**
```jsx
// En SociosPage:177-180 y SuperAdminPage:108
{serverError && (
  <div role="alert" className="...">
    {serverError}
  </div>
)}
// useEffect(() => {
//   if (serverError) {
//     const timer = setTimeout(() => setServerError(""), 5000);
//     return () => clearTimeout(timer);
//   }
// }, [serverError]);
```
**Esfuerzo:** 30 min

#### 2. AnimalFormPage Formulario Sin Step Indicator
**Ubicación:** AnimalFormPage:256-480
**Problema:** Formulario masivo (13 campos, 5 secciones) sin indicación visual de progreso
**Solución:** Implementar sticky tabs o step indicator
**Esfuerzo:** 2 horas

#### 3. Foto Upload UX Separada del Form
**Ubicación:** AnimalFormPage:500-592
**Problema:** Usuario no puede subir fotos al crear → debe esperar redirect
**Solución:** Cambiar flujo: crear sin fotos, redirect, mostrar foto section con "3 requeridas"
**Esfuerzo:** 3 horas (cambio de backend posible)

#### 4. Validaciones Page: Approve Error Persiste
**Ubicación:** ValidacionesPage:86-89
**Problema:** Error no desaparece automáticamente, confunde si retry funcionó
**Solución:** Auto-dismiss 5s O mostrar success toast
**Esfuerzo:** 1 hora

#### 5. SuperAdminPage Form Inline
**Ubicación:** SuperAdminPage:76-117
**Problema:** Form inline sin estructura, difícil en mobile
**Solución:** Mover a modal (similar a SociosPage modal pattern)
**Esfuerzo:** 2 horas

---

### 🟡 Importante (Degrada Experiencia)

#### 6. ImportPage Table Sin Sticky Header
**Ubicación:** ImportPage:197-227
**Solución:** Añadir `sticky top-0` a `<thead>`
**Esfuerzo:** 30 min

#### 7. AnimalFormPage Madre Mode Loading
**Ubicación:** AnimalFormPage:76-79, 410-425
**Problema:** Si madreMode=lote y lotesData loading, select vacío sin feedback
**Solución:** Mostrar "Cargando lotes..." placeholder
**Esfuerzo:** 1 hora

#### 8. Genealogy Query Sin Loading Visual
**Ubicación:** AnimalFormPage:65-69
**Problema:** Click "Ver árbol" → query inicia pero no hay skeleton/spinner
**Solución:** Mostrar Loader2 spinner mientras isLoading
**Esfuerzo:** 1 hora

#### 9. CandidatosReproductorPage Expand Patrón
**Ubicación:** CandidatosReproductorPage:70-174
**Problema:** Expansión requiere chevron click, acciones están dentro → 2 clicks
**Solución:** Quick approve/deny inline + modal solo para notas
**Esfuerzo:** 2 horas

#### 10. ReportesPage Sin Cancel
**Ubicación:** ReportesPage
**Problema:** Usuario no puede cancelar job una vez iniciado
**Solución:** Implementar cancel endpoint + button (solo si PENDING/PROCESSING)
**Esfuerzo:** 3 horas (incluye backend)

---

## 8. Quick Wins (Alto Impacto, Bajo Esfuerzo)

| # | Página | Fix | Esfuerzo | Impacto |
|---|--------|-----|----------|---------|
| 1 | Todos | Auto-dismiss error messages (5s) | 30 min | 🔴 ALTO |
| 2 | ImportPage | Sticky header en tabla | 15 min | 🟡 MEDIO |
| 3 | AnimalFormPage | "Cargando lotes..." en select | 30 min | 🟡 MEDIO |
| 4 | ValidacionesPage | Toast "Aprobado" después de success | 1 h | 🟡 MEDIO |
| 5 | Modales | Añadir `role="dialog"` + focus trap | 1.5 h | 🟡 ALTO (a11y) |
| 6 | SociosPage | Debounce search input | 30 min | 🟡 MEDIO |
| 7 | SuperAdminPage | Mover form a modal | 2 h | 🟡 MEDIO |

---

## 9. Accesibilidad — Plan de Remediación

### Prioridad 1 (WCAG AA Violations)
1. Añadir `aria-live="polite"` a todos los error/success containers
2. Implementar focus trap en modales (usar library como `focus-trap-react`)
3. Añadir `role="dialog"` + `aria-label` a modales
4. Table headers con `scope="col"`

### Prioridad 2 (AAA/Mejoras)
1. Aumentar contraste en algunos textos (gris-400 sobre white puede ser < 4.5:1)
2. Keyboard navigation testing en modales
3. Screen reader testing en flows principales

---

## 10. Recomendaciones Finales

### Arquitectura
- **No cambiar** React Query + React Hook Form — excelentes choices
- **Considerar** agregar Toast library (como `sonner` o `react-hot-toast`) para mensajes transitorios
- **Considerar** agregar Modal wrapper con focus trap integrado

### Design System
- Crear file `constants/ui.ts` con timeouts (AUTO_DISMISS_ERROR_MS = 5000, etc.)
- Documentar patrones: error handling, loading states, confirmations

### Testing
- [ ] Accessibility audit con WAVE/Axe
- [ ] Mobile testing en iPhone 12 (390px) + iPad (768px)
- [ ] Network throttling (Fast 3G) para simular celular

### Próximas Sprints Recomendadas
1. **Sprint 1:** Arreglar 5 problemas críticos (auto-dismiss, AnimalForm, SuperAdmin modal, Validaciones toast, Focus trap)
2. **Sprint 2:** Accessibility audit + remediación (aria-live, table scope, role="dialog")
3. **Sprint 3:** Experiencia desktop avanzada (sticky headers, virtualization en listas largas)

---

## 11. Matriz de Severidad vs. Esfuerzo

```
ALTO ESFUERZO / ALTO IMPACTO (Hacer primero)
- AnimalFormPage step indicator
- Foto upload UX refactor
- CandidatosPage expand UX

BAJO ESFUERZO / ALTO IMPACTO (Quick wins)
- Auto-dismiss errors
- Sticky headers
- Aria-live + role="dialog"
- Focus trap modales

BAJO ESFUERZO / BAJO IMPACTO (Opcional)
- Color picker keyboard support
- Genealogy virtualization
- Report progress indicator

ALTO ESFUERZO / BAJO IMPACTO (Skip)
- Complete dark mode
- Internacionalization (ya en español)
```

---

## 12. Conclusión

AGAMUR tiene una **arquitectura sólida** pero **implementación UX inconsistente**. Los 5 problemas críticos son solucionables en 1 sprint (8-10 horas). La app se volvería significativamente más usable con:

1. ✅ Auto-dismiss error messages
2. ✅ Error handling unificado y consistente
3. ✅ Loading states visibles en todas las operaciones async
4. ✅ Modales con focus trapping
5. ✅ Confirmaciones explícitas para acciones destructivas

La línea base UX es **7.5/10** → Con fixes = **8.5/10** realista (9/10 requeriría refactorización más profunda).

**Recomendación:** Implementar quick wins primero (30 min cada uno), luego asignar 1-2 sprints a problemas importantes. Accesibilidad debería ser parallel (no bloqueante).
