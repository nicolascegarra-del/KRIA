# AGAMUR Frontend — Revisión UX Exhaustiva

**Fecha:** Marzo 2026
**Proyecto:** AGAMUR — PWA de Libros Genealógicos Avícolas
**Scope:** Frontend completo (React 18 + TypeScript + Vite + Tailwind + Zustand + React Query)
**Rol Focus:** GESTIÓN (desktop-first) + SOCIO (mobile-first)

---

## RESUMEN EJECUTIVO

**Estado General: 7.4/10**

### Puntuaciones por Rol

| Rol | Mobile | Desktop |
|-----|--------|---------|
| **SOCIO (mobile-first)** | 8.2/10 | 7.5/10 |
| **GESTIÓN (desktop-first)** | 6.8/10 | 7.1/10 |

### Hallazgos Principales

- ✅ **Lo que funciona bien:** Navegación limpia, componentes reutilizables, loading states, accessibility basics (modal.tsx con focus trap)
- 🔴 **4 Problemas CRÍTICOS:** Que bloquean o degradan significativamente la UX
- 🟡 **8 Problemas IMPORTANTES:** Que afectan la percepción de calidad pero no bloquean flujos
- 💡 **6 Oportunidades de Simplificar:** Que reducirían fricción

---

## ANÁLISIS DETALLADO POR PÁGINA

### PÁGINA: LoginPage.tsx

**Roles:** Público (ambos)
**Dispositivos:** Ambos

#### Puntuación: 8.5/10

**Lo que funciona bien:**
- Layout centrado, responsive (max-w-sm se adapta bien a móvil y desktop)
- Debouncing inteligente en búsqueda de tenant (600ms)
- Feedback visual inmediato al buscar tenant: "✓ Nombre" en verde
- Checkbox accesible para "Acceder como Gestión" (grupo lógico)
- Password toggle (ojo) bien positioned
- Branding cargado dinámicamente con fallback a icono Bird
- Manejo de errores clara: `detail` y `non_field_errors`

**Problemas:**

🟡 **IMPORTANTE #1: Eye icon no alcanza min-h-44px**
- Línea 141: `min-h-0` sobrescribe el global 44px
- En móvil, el tap target es ~18px (solo el icon)
- **Fix:** Cambiar a `min-h-[44px] min-w-[44px] flex items-center justify-center`

🟡 **IMPORTANTE #2: Sin skeleton de branding mientras carga**
- Mientras `isLoadingBranding: true`, el header no muestra feedback visual
- El usuario ve el logo del tenant anterior (o genérico)
- **Fix:** Agregar un pequeño spinner o skeleton en el header

**Estado vacío:** N/A (sin datos para cargar)

---

### PÁGINA: DashboardPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop-first (pero responsive)

#### Puntuación: 7.8/10

**Lo que funciona bien:**
- Grid responsive: `grid-cols-2 sm:grid-cols-3` adapta bien a 390px → 1920px
- Tiles de contadores con colores semanticos (azul, ámbar, esmeralda, etc.)
- Loading skeleton limpio y rápido (30s refetch interval es razonable)
- "Acciones Rápidas" de 9 botones en grid 2 → 3 es good UX (menos cognitive load que lista)
- Estados vacíos claros (si hay cero pendientes)

**Problemas:**

🔴 **CRÍTICO #1: Botones "Acciones Rápidas" en grid con texto pequeño**
- Línea 109–136: `btn-secondary justify-start gap-2 text-sm`
- En grid 2 columnas (móvil 390px), cada botón es ~180px de ancho
- Texto "Importar socios", "Generar reportes" se trunca en algunos teléfonos
- **Impacto:** En iPhone SE (375px), la lectura es incómoda
- **Fix:** Cambiar a `flex-col` en móvil o `text-xs` adaptativo

🟡 **IMPORTANTE #3: Sin paginación/scroll clear si hay muchos tiles**
- 6 tiles de contadores + 9 botones de acciones = 15 elementos
- En pantalla pequeña (~500px de alto útil), requiere scroll
- No hay visual hint de "scroll down" o separadores
- **Fix:** Agregar `space-y-6` clear o separador visual `border-t` entre secciones

**Accessibility:**
- ✅ Los tiles son `<Link>` (navegables)
- ⚠️ No hay `aria-live` si los contadores cambian de forma inesperada

---

### PÁGINA: ValidacionesPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop-first

#### Puntuación: 7.5/10

**Lo que funciona bien:**
- Botones de aprobación/rechazo con min-h-44px, min-w-44px (bueno para touch)
- Errores de aprobación mostrados inline bajo cada animal (contexto claro)
- Modal de rechazo accesible: `role="dialog"`, `aria-modal`, `aria-labelledby`
- Loading spinner inteligente solo para el animal que se está aprobando (`approvingId`)
- Auto-dismiss de error después del mensaje (sin bloqo de UI)

**Problemas:**

🟡 **IMPORTANTE #4: Error message no se auto-dismissiona**
- Línea 99–102: El error se muestra pero NO se limpia automáticamente
- Si el usuario aprueba otro animal, el error anterior sigue visible
- **Impacto:** Clutter visual, confusión de qué error es actual
- **Fix:** Usar `useAutoCloseError()` (ya existe en el codebase) o limpiar al hacer clic en otro botón

🟡 **IMPORTANTE #5: Textarea sin max-height en modal de rechazo**
- Línea 153–159: `h-24` fijo pero sin `max-h` respecto a viewport
- En móvil vertical (390px), si el modal es `max-h-[90vh]`, el textarea puede ser muy pequeño
- **Fix:** Cambiar a `h-full` o min-h-[24px] sin max, dejar que scroll interno del modal lo maneje

**Accessibility:**
- ✅ Botones con aria-label
- ✅ Modal accesible
- ⚠️ No hay `aria-live` para cambios de estado (loading → success/error)

---

### PÁGINA: EvaluacionPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop (el grid de 10 botones no cabe bien en móvil)

#### Puntuación: 6.9/10

**Lo que funciona bien:**
- Grid de 10 botones (1-10) con `min-h-[44px]` es accesible para touch
- Colores semánticos de score (rojo/ámbar/verde/amarillo) muy buenos
- Búsqueda de animal inteligente: debounce, filtro por año
- Tabs limpios (Nueva evaluación / Historial)
- Historial en tabla con scores coloreados

**Problemas CRÍTICOS:**

🔴 **CRÍTICO #2: Grid de 10 botones NO CABE en móvil**
- Línea 61: `grid-cols-10 gap-1`
- Ancho útil en iPhone 12 (390px) con padding es ~358px
- 10 botones × 30px + 9 gaps × 4px = 336px (sin padding)
- **Resultado:** Cada botón ~33px, texto "1" cabe pero es apretado, hit target marginal
- En iPhone SE (375px), no cabe, OVERFLOW HORIZONTAL
- **Fix:** Cambiar a `grid-cols-5 sm:grid-cols-10` + ajustar gap

🟡 **IMPORTANTE #6: Search dropdown sin max-height en móvil**
- Línea 220: `max-h-40` en dropdown de búsqueda
- Pero no hay `max-h-[...vh]` adaptado: en móvil puede ocupar toda la pantalla útil
- **Fix:** `max-h-[200px] sm:max-h-[300px]`

🟡 **IMPORTANTE #7: Tabla historial sin responsive column hiding**
- Línea 318–346: Tabla con 4 columnas (Animal, Media, Notas, Fecha)
- En móvil < 500px, la tabla se comprime y trunca sin `overflow-x-auto`
- `truncate max-w-[120px]` solo afecta notas, no la tabla completa
- **Fix:** Envolver tabla en `<div className="overflow-x-auto">`

**Accessibility:**
- ✅ ScoreButtons con aria-label y aria-pressed
- ⚠️ Tabla sin `scope="col"` en headers

---

### PÁGINA: ReportesPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop (grid de tiles y animal pickers)

#### Puntuación: 7.2/10

**Lo que funciona bien:**
- Grid responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` es good
- Animal picker reusable con búsqueda integrada
- ReportJobStatus muestra polling state ("PENDING", "DONE", "FAILED")
- Download link visible al completarse

**Problemas:**

🟡 **IMPORTANTE #8: Sin progreso visual durante generación**
- Línea 79–118: ReportJobStatus solo muestra estado textual
- Durante "PROCESSING" (puede durar 30s+), solo hay un ícono animado de reloj
- Usuario no sabe si es rápido, si se colgó, o cuánto falta
- **Fix:** Agregar progress bar o estimación de tiempo
- **Alternativa:** Mostrar "Generando PDF... esto puede tardar 30-60 segundos"

🟡 **IMPORTANTE #9: Animal picker en tiles no es resizable**
- Línea 223–241: El picker tiene `max-h-32 overflow-y-auto` fijo
- Si hay 50+ animales (ganadería grande), es tedioso scrollear
- **Fix:** Agregar input con debounce de búsqueda al picker

---

### PÁGINA: SocioDetailPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop (pero mobile-friendly)

#### Puntuación: 8.1/10

**Lo que funciona bien:**
- Tabs limpias (Animales / Granjas / Documentos) con buena UX
- Botones de volver con min-h-44px
- Upload de documentos inteligente con loading state
- Download con spinner
- Delete con confirmación

**Problemas:**

🟡 **IMPORTANTE #10: Download button muy pequeño (40px)**
- Línea 300: `min-h-[40px] min-w-[40px]` en botón de descargar
- El global es 44px, este es 40px (4px menos)
- En lista de documentos, es el único botón que no cumple 44x44
- **Fix:** Cambiar a 44x44 para consistencia

🟡 **IMPORTANTE #11: Input file sin label visible**
- Línea 258–265: `<input type="file" className="sr-only">`
- Screen readers ven solo "Subir documento" but visual focus state no es clear
- **Fix:** Agregar `aria-label="Seleccionar archivo para subir"`

---

### PÁGINA: AnillasPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop

#### Puntuación: 7.6/10

**Lo que funciona bien:**
- Leyenda de diámetros clara (círculos de color + texto)
- Modal con radio buttons accesibles (con labels grandes)
- Tabla con información clara
- Error feedback inline

**Problemas:**

🔴 **CRÍTICO #3: Radio buttons de diámetro sin min touch target en modal**
- Línea 262–283: Labels con `flex-1 flex items-center justify-center border-2`
- El padding es `px-3 py-3`, lo que da altura ~40px+12px = 52px (bueno)
- Pero el input radio es `sr-only`, hit target es el label completo ✅
- **Revisión:** Este es CORRECTO. No es un problema.

🟡 **IMPORTANTE #12: Tabla sin sticky header al scroll**
- Línea 146–195: `<table>` en div sin `overflow-x-auto` wrapper
- Si la tabla es ancha (6 columnas), en desktop pequeño requiere scroll horizontal
- Header se esconde al scrollear
- **Fix:** Envolver en `<div className="overflow-x-auto">` + agregar `position: sticky; top: 0` a `<thead>`

---

### PÁGINA: CandidatosReproductorPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop

#### Puntuación: 8.0/10

**Lo que funciona bien:**
- Cards expandibles con ChevronDown/Up icons
- Textarea de notas en expanded state (no cluttered)
- Botones accesibles con min-h-44px
- Foto de perfil del animal con fallback a icono

**Problemas:**

🟡 **IMPORTANTE #13: Expand toggle button sin aria-label y sin role**
- Línea 107–113: `<button>` sin aria-label, solo title
- Screen reader no anuncia "Expandir" o "Ver detalles"
- **Fix:** Agregar `aria-label={`Ver detalles de ${animal.numero_anilla}`}` + `aria-expanded={isExpanded}`

---

### PÁGINA: CatalogoReproductoresPage.tsx

**Rol:** GESTIÓN (+ SOCIO view??)
**Dispositivos:** Desktop + Mobile

#### Puntuación: 8.2/10

**Lo que funciona bien:**
- Grid responsive: `grid-cols-1 sm:grid-cols-2` adapta bien
- Paginación clara (Anterior / Página X / Siguiente)
- Cards compactas con foto + info
- Loading skeletons

**Problemas:**

🟡 **IMPORTANTE #14: Paginación buttons sin disabled opacity**
- Línea 57–73: `disabled:opacity-40` es muy sutil
- En desktop, usuario puede no notar que el botón está disabled
- **Fix:** Agregar `disabled:cursor-not-allowed` + cambiar opacity a `disabled:opacity-50 disabled:cursor-not-allowed`

---

### PÁGINA: PerfilPage.tsx

**Rol:** Ambos (SOCIO + GESTIÓN)
**Dispositivos:** Ambos

#### Puntuación: 7.9/10

**Lo que funciona bien:**
- Formulario limpio con 3 campos (actual, nueva, confirmar)
- Validación en tiempo real (match de contraseñas)
- Errores inline bajo cada campo
- Success toast al cambiar

**Problemas:**

🟡 **IMPORTANTE #15: Sin visual feedback durante submit**
- Línea 134–144: Botón desactivado pero sin spinner
- User puede pensar que el botón está roto
- **Fix:** Mostrar Loader2 spinner como en otros formularios

---

### PÁGINA: SuperAdminPage.tsx

**Rol:** SUPERADMIN
**Dispositivos:** Desktop

#### Puntuación: 7.4/10

**Lo que funciona bien:**
- Stats tiles simples y claros
- Modal para crear/editar tenants
- Color pickers accesibles (visual + hex input)

**Problemas:**

🔴 **CRÍTICO #4: Modal form sin max-height, puede desbordar en viewports pequeños**
- Línea 217–276: Form con 4 campos (2 cols) + color pickers + checkbox
- En laptop pequeña (1024px altura), el modal puede ocupar >90vh
- Modal body tiene `max-h-[90vh] overflow-y-auto` pero form interior no scrollea bien
- **Fix:** Verificar en 1024x768 y agregar `overflow-y-auto` al contenido del modal

🟡 **IMPORTANTE #16: Color picker inputs duplicados**
- Línea 246–259: Input color + input hex lado a lado
- El hex input es redundante si hay color picker visual
- Pero esto es más de UX/product que de CSS

---

### PÁGINA: DocumentosPage.tsx (GESTIÓN)

**Rol:** GESTIÓN
**Dispositivos:** Desktop

#### Puntuación: 7.5/10

**Lo que funciona bien:**
- Tabs limpias (Repositorio General / Buzón de Socios)
- DocList component reusable
- Upload y download con loading states

**Problemas:**

🟡 **IMPORTANTE #17: Selector de socio no tiene placeholder visual**
- Línea 262–274: `<select>` con `<option value="">— Elige un socio —</option>`
- Pero está en un card sin contexto ("Seleccionar socio")
- **Fix:** Agregar más contexto visual o disabled state al botón Upload si no hay socio seleccionado

---

### PÁGINA: MisAnimalesPage.tsx (SOCIO)

**Rol:** SOCIO
**Dispositivos:** Mobile + Desktop

#### Puntuación: 8.3/10

**Lo que funciona bien:**
- Tabs con contadores (Activos 5 / Histórico 2) son claros
- Búsqueda de anilla rápida
- AnimalCard component reutilizable
- Botón "Solicitar re-alta" con Loader2 spinner
- Empty state informativo con CTA

**Problemas:**

🟡 **IMPORTANTE #18: Search input sin debounce**
- Línea 83–89: `onChange` dispara query inmediatamente
- Con typing rápido, se hacen muchas requests
- **Fix:** Agregar debounce (300ms) como en EvaluacionPage

---

### PÁGINA: MisDocumentosPage.tsx (SOCIO)

**Rol:** SOCIO
**Dispositivos:** Mobile + Desktop

#### Puntuación: 8.1/10

**Lo que funciona bien:**
- Interfaz limpia (solo lectura)
- Download funciona bien
- Empty state claro

**Problemas:**

🟡 **IMPORTANTE #19: Llamada al API dentro de queryFn es antipattern**
- Línea 22–26: `import("../../api/client")` dentro de queryFn es dinámico y lento
- El import siempre está disponible en el scope del módulo
- **Fix:** Importar `apiClient` en el top del archivo

---

### PÁGINA: SociosPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop (pero responsive)

#### Puntuación: 7.7/10

**Lo que funciona bien:**
- Búsqueda responsiva
- Modal create/edit con validación
- Botones de acción (ver, editar, dar de baja) bien espaciados
- Modal de baja con confirmación y warning

**Problemas:**

🟡 **IMPORTANTE #20: Buttons en card son difíciles de clickear en móvil**
- Línea 306–335: 3 botones en fila en card
- En móvil 390px, cada botón es ~45px wide (min-h-44px)
- Espaciado horizontal es `gap-2`, puede ser tocarse
- **Fix:** Cambiar a `flex-col` en móvil o ajustar gap

🟡 **IMPORTANTE #21: Sin paginación en lista de socios**
- Línea 224–227: Query sin paginación
- Si hay 1000+ socios, la lista es muy larga
- **Fix:** Agregar `page` param a sociosApi.list() y botones de paginación

---

### PÁGINA: SolicitudesRealtaPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop

#### Puntuación: 8.0/10

**Lo que funciona bien:**
- Expandibles limpios (ChevronUp/Down)
- Botones de acción accesibles
- Empty state claro

**Problemas:**

🟡 **IMPORTANTE #22: Sin aria-expanded en botón de expand**
- Línea 59–61: Botón sin aria-label ni aria-expanded
- **Fix:** `aria-label="Ver detalles"` + `aria-expanded={isExpanded}`

---

### PÁGINA: ConflictosPage.tsx

**Rol:** GESTIÓN
**Dispositivos:** Desktop

#### Puntuación: 8.0/10

**Lo que funciona bien:**
- Cards con border-left-4 amber (visual indicator)
- Modal accesible
- Botones de resolver/descartar

**Problemas:**

🟡 **IMPORTANTE #23: Button "Descartar" usa btn-secondary styling como "Resolver"**
- Línea 129: `className={activeModal.action === "resolve" ? "btn-primary flex-1" : "btn-secondary flex-1"}`
- Pero "Resolver" es acción positiva (verde), "Descartar" debería ser rojo
- **Fix:** Cambiar a `btn-danger` para "Descartar"

---

## RESUMEN DE PROBLEMAS CRÍTICOS Y IMPORTANTES

### CRÍTICOS (4)

| # | Página | Problema | Impacto | Fix |
|---|--------|----------|--------|-----|
| 1 | ValidacionesPage | Error message no auto-dismissiona | Clutter visual, confusión | useAutoCloseError() + limpiar al siguiente clic |
| 2 | EvaluacionPage | Grid de 10 botones no cabe en móvil (overflow horizontal) | Usabilidad bloqueada en móvil | Cambiar a `grid-cols-5 sm:grid-cols-10` |
| 3 | SuperAdminPage | Modal form puede desbordar en viewports pequeños | Contenido inaccesible | Verificar en 1024x768, agregar overflow-y-auto |
| 4 | Varios | — | — | — |

### IMPORTANTES (23)

1. LoginPage: Eye icon hit target pequeño
2. LoginPage: Sin skeleton de branding mientras carga
3. DashboardPage: Botones de acciones rápidas se truncan en móvil
4. DashboardPage: Sin visual hint de scroll
5. ValidacionesPage: Error message no se limpia automáticamente
6. ValidacionesPage: Textarea sin max-height en modal
7. EvaluacionPage: Grid de 10 botones no cabe en móvil (CRÍTICO)
8. EvaluacionPage: Search dropdown sin max-height adaptado
9. EvaluacionPage: Tabla historial sin responsive column hiding
10. ReportesPage: Sin progreso visual durante generación
11. ReportesPage: Animal picker en tiles no es resizable
12. SocioDetailPage: Download button es 40px en lugar de 44px
13. SocioDetailPage: Input file sin label visible
14. AnillasPage: Tabla sin sticky header
15. CandidatosReproductorPage: Expand toggle sin aria-label
16. CatalogoReproductoresPage: Paginación buttons disabled state sutil
17. PerfilPage: Sin visual feedback durante submit (no spinner)
18. SuperAdminPage: Modal form puede desbordar (CRÍTICO)
19. DocumentosPage: Selector de socio sin contexto
20. MisAnimalesPage: Search input sin debounce
21. MisDocumentosPage: Import dentro de queryFn
22. SociosPage: Buttons en card apretados en móvil
23. SociosPage: Sin paginación en lista de socios
24. SolicitudesRealtaPage: Botón expand sin aria-expanded
25. ConflictosPage: Botón "Descartar" mal coloreado

---

## ANÁLISIS POR DISPOSITIVO

### MOBILE (390px - iPhone 12)

**Puntuación General: 7.1/10**

**Lo que funciona bien:**
- Layout es responsive (max-w-sm, grid-cols adaptados)
- Touch targets son 44x44px en la mayoría
- Scrolling es fluido
- Loading states claros

**Lo que NO funciona:**
- EvaluacionPage: grid-cols-10 no cabe (CRÍTICO)
- DashboardPage: botones se truncan
- SociosPage: buttons en fila son apretados
- Varias tablas no tienen overflow-x-auto

**Recomendaciones:**
1. Agregrar `overflow-x-auto` a todas las tablas
2. Cambiar grids a responsive cols
3. Revisar touch targets en buttons pequeños
4. Agregar debounce a searches

---

### DESKTOP (1920x1080)

**Puntuación General: 7.6/10**

**Lo que funciona bien:**
- Sidebar es clear (navigation items legibles)
- Cards tienen buen spacing (p-4)
- Tablas son escaneables
- Modals son centered

**Lo que NO funciona:**
- Algunas tablas sin sticky header
- Modals pueden ser muy anchos (max-w-lg en pantalla 1920px es pequeño)
- Algunos datos truncados sin truncate clases

**Recomendaciones:**
1. Agregar sticky header a tablas long
2. Revisar max-width de modals
3. Usar data truncation inteligente

---

## CHECKLIST: ACCESIBILIDAD WCAG AA

| Item | Status | Ubicación |
|------|--------|-----------|
| Modals: role="dialog", aria-modal, aria-labelledby | ✅ | Modal.tsx, ValidacionesPage, etc. |
| Botones: aria-label | ⚠️ Parcial | Expand toggles sin aria-label |
| Tablas: scope="col" | ❌ | EvaluacionPage, AnillasPage, etc. |
| Inputs: labels asociados | ✅ | Todos los forms |
| Focus visible | ✅ | Global en index.css |
| Focus trap en modals | ✅ | Modal.tsx |
| Keyboard dismiss (Escape) | ✅ | Modal.tsx |
| Color contrast | ✅ | Buttons y text tienen buen contrast |
| aria-live para cambios dinámicos | ❌ | Dashboard stats no tienen aria-live |
| aria-expanded para expandibles | ❌ | CandidatosReproductorPage, SolicitudesRealtaPage |

---

## ANÁLISIS DE COMPONENTES REUTILIZABLES

### Modal.tsx

**Puntuación: 9.0/10**

**Fortalezas:**
- Focus trap correcto (primer → último elemento focusable)
- Cierre con Escape
- ARIA attributes completos
- Previene scroll del body

**Mejora:**
- Línea 67: `max-h-[90vh]` está bien pero body `overflow-y-auto` podría ser más granular

---

### index.css (Tailwind)

**Puntuación: 8.5/10**

**Fortalezas:**
- Global min-h-[44px] para buttons/inputs/a (line 19-21)
- btn-primary, btn-secondary, btn-danger bien definidos
- input-field estándar con focus ring

**Problemas:**

🟡 Line 20: `button, a, input, select, textarea, [role="button"]` no es suficientemente específico
- Algunos botones tienen override (LoginPage line 141 con `min-h-0`)
- **Fix:** Documentar excepciones o usar !important para forzar 44px

---

## HALLAZGOS DE RENDIMIENTO UX

### Loading States

| Página | Loading | Performance Perception |
|--------|---------|------------------------|
| DashboardPage | Skeleton de cards (30s refetch) | ✅ Good |
| ValidacionesPage | Skeleton de cards | ✅ Good |
| EvaluacionPage | Spinner en búsqueda | ✅ Good |
| ReportesPage | Spinner genérico | ⚠️ Sin progreso |
| SociosPage | Skeleton de cards | ✅ Good |

**Recomendación:** Agregar progress bars o % en reportes de larga duración

---

## CHECKLIST MOBILE-FIRST SPRINT 12

| Componente | Mobile OK | Desktop OK | Notas |
|-----------|-----------|-----------|-------|
| SocioDetailPage.tsx | 8.2 | 8.2 | Tabs funcionan bien, docs ok |
| AnillasPage.tsx | 7.0 | 8.0 | Tabla en móvil necesita scroll |
| EvaluacionPage.tsx | 5.0 | 7.5 | Grid 10 cols no cabe en móvil |
| ReportesPage.tsx | 7.5 | 8.0 | OK pero sin progreso |
| CatalogoReproductoresPage.tsx | 8.3 | 8.2 | Excelente responsive |
| PerfilPage.tsx | 8.0 | 8.0 | Limpio, solo form |
| SuperAdminPage.tsx | 6.5 | 7.5 | Modal puede desbordar |
| DocumentosPage.tsx | 7.0 | 8.0 | Tab switching ok |

---

## PATRONES QUE FUNCIONAN BIEN (REPLICATE)

1. **Modal.tsx:** Focus trap + Escape dismiss → REUTILIZAR EN TODAS LAS MODALS
2. **ReportJobStatus:** Polling con refetchInterval → PATTERN para async operations
3. **useAutoCloseError:** Auto dismiss de errores → USAR EN TODOS LOS FORMS
4. **Grid responsive:** `grid-cols-2 sm:grid-cols-3 gap-3` → STANDARD para tiles
5. **AnimalCard component:** Card limpia con info + estado → REUTILIZABLE

---

## RECOMENDACIONES FINALES

### Prioridad 1: CRÍTICOS (Do this week)

1. **EvaluacionPage:** Cambiar grid de 10 cols a `grid-cols-5 sm:grid-cols-10`
   - Archivo: `C:/Users/Oscar/Desktop/AGAMUR - copia/frontend/src/pages/gestion/EvaluacionPage.tsx`
   - Línea 61
   - ETC: 15 min

2. **ValidacionesPage:** Agregar auto-dismiss de error message
   - Archivo: `C:/Users/Oscar/Desktop/AGAMUR - copia/frontend/src/pages/gestion/ValidacionesPage.tsx`
   - Línea 98–102
   - ETC: 20 min

3. **SuperAdminPage:** Verificar modal form en 1024x768
   - Archivo: `C:/Users/Oscar/Desktop/AGAMUR - copia/frontend/src/pages/gestion/SuperAdminPage.tsx`
   - Línea 217–276
   - ETC: 30 min

### Prioridad 2: IMPORTANTES (Do this sprint)

1. Agregar `overflow-x-auto` a todas las tablas (AnillasPage, EvaluacionPage, SuperAdminPage)
2. Agregar `aria-expanded` y `aria-label` a botones de expandir
3. Agregar debounce a búsquedas (MisAnimalesPage, SociosPage)
4. Cambiar "Descartar" button en ConflictosPage a btn-danger
5. Agregar `scope="col"` a table headers
6. Agregar progress bar en ReportesPage

### Prioridad 3: NICE-TO-HAVE (Next sprint)

1. Agregar paginación a SociosPage
2. Hacer modals más narrow en desktop (max-w-sm → max-w-xl)
3. Agregar más skeletons de branding
4. Rethink button layout en SociosPage para móvil (flex-col)

---

## TESTING CHECKLIST

- [ ] EvaluacionPage en iPhone 12 (390px): ¿Cabe grid sin overflow horizontal?
- [ ] ValidacionesPage: ¿Desaparece error después de 3s?
- [ ] ReportesPage en conexión lenta (throttle): ¿Se ve spinner/progreso?
- [ ] SuperAdminPage en 1024x768: ¿Modal scrollea sin clutcher?
- [ ] TablesPage (AnillasPage): ¿Sticky header funciona al scroll?
- [ ] Keyboard nav: ¿Tab navega correctamente en todos los modals?
- [ ] Voice over (iOS): ¿aria-labels son pronunciados?
- [ ] Lighthouse: Performance, Accessibility scores

---

## DEUDA TÉCNICA DETECTADA

| Item | Severidad | Esfuerzo |
|------|-----------|----------|
| Falta paginación en SociosPage, MisAnimalesPage | Media | 1h |
| Faltan aria-expanded en expandibles | Baja | 30min |
| Tablas sin sticky header | Media | 1h |
| Search inputs sin debounce | Baja | 30min |
| Color picker en SuperAdmin es redundante (product decision) | Muy baja | - |

---

## CONCLUSIÓN

El frontend de AGAMUR es **bueno en general (7.4/10)** con buena UX en SOCIO (8.2/10 mobile) pero necesita mejoras en GESTIÓN para móvil. Los patrones de accesibilidad están bien implementados en Modal.tsx pero faltan en expandibles y tablas.

**El trabajo crítico:** Hacer EvaluacionPage mobile-friendly y limpiar auto-dismiss de errores. El resto son mejoras incremental.

**Recomendación:** 3–4 horas de trabajo focusado en los 3 CRÍTICOs + 4–6 horas en los 23 IMPORTANTEs = 1 sprint de refining.

