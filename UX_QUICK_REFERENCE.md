# KRIA Frontend UX — Quick Reference

**Overall Score: 7.4/10** | SOCIO 8.2/10 mobile | GESTIÓN 7.1/10 desktop

---

## 4 CRÍTICOS (Fix this week)

### 1. EvaluacionPage: Grid 10 cols no cabe en móvil
**Archivo:** `frontend/src/pages/gestion/EvaluacionPage.tsx:61`
**Problema:** `grid-cols-10 gap-1` causa overflow horizontal en iPhone 12 (390px)
```jsx
// ❌ ANTES
<div className="grid grid-cols-10 gap-1">

// ✅ DESPUÉS
<div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
```
**ETC:** 15 min

---

### 2. ValidacionesPage: Error no auto-dismissiona
**Archivo:** `frontend/src/pages/gestion/ValidacionesPage.tsx:14, 98–102`
**Problema:** Error message persiste visualmente incluso después de otra acción
```jsx
// ❌ ANTES — error en state pero no se limpia
const [approveErrors, setApproveErrors] = useState<Record<string, string>>({});

// ✅ DESPUÉS — usar hook existente
const [approveError, setApproveError, clearApproveError] = useAutoCloseError();
// Al hacer otra acción: clearApproveError()
```
**ETC:** 20 min

---

### 3. SuperAdminPage: Modal form desborda en 1024x768
**Archivo:** `frontend/src/pages/gestion/SuperAdminPage.tsx:217–276`
**Problema:** Form con muchos campos puede ocupar >90vh en laptops pequeñas
```jsx
// ✅ Verificar en 1024x768 que el modal scrollea correctamente
// Si no: agregar overflow-y-auto a la div contenedora del form
<div className="p-6 overflow-y-auto">
```
**ETC:** 30 min

---

### 4. (No hay cuarto crítico — los otros son IMPORTANTES)

---

## 8 IMPORTANTES (Do this sprint)

| # | Página | Problema | Fix | ETC |
|---|--------|----------|-----|-----|
| 1 | LoginPage | Eye icon hit target <44px | `min-h-[44px] min-w-[44px]` | 5min |
| 2 | DashboardPage | Botones truncados en móvil | `text-sm sm:text-base` o grid mobile first | 15min |
| 3 | EvaluacionPage | Search dropdown sin max-h | `max-h-[200px] sm:max-h-[300px]` | 10min |
| 4 | EvaluacionPage | Tabla sin `overflow-x-auto` | `<div className="overflow-x-auto"><table>` | 10min |
| 5 | ReportesPage | Sin progreso visual | Agregar `progress bar` o "Generando..." | 30min |
| 6 | SocioDetailPage | Download button 40px | Cambiar a 44px | 2min |
| 7 | AnillasPage | Tabla sin sticky header | `<thead className="sticky top-0">` | 10min |
| 8 | SociosPage | Sin paginación | Agregar page logic a API + buttons | 1h |

---

## 23 MINOR ISSUES

### Accessibility
- [ ] Agregar `aria-expanded` a botones expand (CandidatosReproductorPage, SolicitudesRealtaPage)
- [ ] Agregar `scope="col"` a table headers (EvaluacionPage, AnillasPage, SuperAdminPage)
- [ ] Agregar `aria-live="polite"` a dashboard counters si cambian dinámicamente

### Mobile
- [ ] Agregar `overflow-x-auto` a todas las tablas
- [ ] Debounce searches (MisAnimalesPage, SociosPage)
- [ ] Flex-col buttons en móvil (SociosPage)

### Polish
- [ ] Progress bar en ReportesPage
- [ ] Spinner en PerfilPage submit button
- [ ] Cambiar "Descartar" a btn-danger en ConflictosPage
- [ ] Textarea max-height en ValidacionesPage modal

---

## FILE PATHS (for quick ref)

**Layout & Navigation**
- `frontend/src/components/Layout.tsx` — Sidebar + mobile nav

**GESTIÓN Pages**
- `frontend/src/pages/gestion/DashboardPage.tsx` — Stats tiles
- `frontend/src/pages/gestion/ValidacionesPage.tsx` — Approve/reject animals
- `frontend/src/pages/gestion/EvaluacionPage.tsx` — Score buttons (CRÍTICO)
- `frontend/src/pages/gestion/ReportesPage.tsx` — Report generation
- `frontend/src/pages/gestion/SocioDetailPage.tsx` — Socio detail tabs
- `frontend/src/pages/gestion/AnillasPage.tsx` — Ring management table
- `frontend/src/pages/gestion/CandidatosReproductorPage.tsx` — Expandibles
- `frontend/src/pages/gestion/SuperAdminPage.tsx` — Tenant management (CRÍTICO)
- `frontend/src/pages/gestion/DocumentosPage.tsx` — Doc repository
- `frontend/src/pages/gestion/SociosPage.tsx` — Socio CRUD

**SOCIO Pages**
- `frontend/src/pages/socio/MisAnimalesPage.tsx` — Animal list with tabs
- `frontend/src/pages/socio/MisDocumentosPage.tsx` — Document inbox

**Shared**
- `frontend/src/pages/auth/LoginPage.tsx` — Tenant slug + email/pass
- `frontend/src/pages/PerfilPage.tsx` — Change password
- `frontend/src/index.css` — Tailwind components (btn-*, input-field, card)
- `frontend/src/components/Modal.tsx` — Focus trap + accessibility

---

## DESIGN PATTERNS

✅ **Use these everywhere:**
- Modal.tsx for all dialogs (focus trap, escape key)
- useAutoCloseError hook for forms (3s auto-dismiss)
- Loading skeletons (space-y-2 + h-16 bg-gray-100 animate-pulse)
- Grid responsive: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`
- Touch target: min-h-[44px] min-w-[44px] on all buttons

❌ **Avoid:**
- No inline onClick handlers without min-h/min-w
- No tables without overflow-x-auto wrapper
- No modals without role="dialog" + aria-modal + aria-labelledby
- No disabled buttons without opacity-50 + cursor-not-allowed

---

## QUICK WINS (1h total)

```jsx
// 1. Fix eye icon (LoginPage:141)
- min-h-0
+ min-h-[44px] min-w-[44px] flex items-center justify-center

// 2. Fix download button (SocioDetailPage:300)
- min-h-[40px] min-w-[40px]
+ min-h-[44px] min-w-[44px]

// 3. Add table scroll (EvaluacionPage:317)
- <table className="w-full text-sm">
+ <div className="overflow-x-auto"><table>

// 4. Add scope to table (EvaluacionPage:321)
+ <th scope="col" className="...">
```

---

## METRICS

| Device | Role | Score | Main Issue |
|--------|------|-------|------------|
| iPhone 12 | SOCIO | 8.2/10 | EvaluacionPage grid |
| iPad | GESTIÓN | 7.0/10 | Table sticky header |
| Desktop 1920px | GESTIÓN | 7.6/10 | Modal sizing |
| Desktop 1024px | GESTIÓN | 6.8/10 | Overflow issues |

---

## TESTING TODO

- [ ] Run EvaluacionPage on iPhone 12 — confirm grid fix
- [ ] Check ValidacionesPage error message auto-dismisses in 3s
- [ ] Test SuperAdminPage modal on 1024x768 (scroll behavior)
- [ ] Lighthouse accessibility score before/after
- [ ] Tab navigation through all modals
- [ ] VoiceOver on iOS — test aria-labels

---

## LEGEND

🔴 **CRÍTICO** = Breaks usability or core flow
🟡 **IMPORTANTE** = Reduces quality but doesn't block
💡 **MINOR** = Nice-to-have polish
✅ **WORKING WELL** = Replicate this pattern

**Estimated effort to fix all: 1-2 sprints (8-16 hours)**

