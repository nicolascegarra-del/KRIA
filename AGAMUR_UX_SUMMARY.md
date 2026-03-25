# AGAMUR Frontend — UX Review Summary (TL;DR)

**Overall Score: 7.5/10**

## The Good ✅
- Clean routing + role-based nav (GESTIÓN vs SOCIO)
- Dashboard con 6 KPI tiles bien organizados
- Validación en 2 pasos (approve/reject) con modales confirmación
- Import 3-fases UX excelente
- React Query + React Hook Form bien implementados
- Touch targets mín 44x44px

## The Bad 🔴 (MUST FIX)
1. **Error messages no auto-dismiss** — Usuario ve errores old después de reload
2. **AnimalFormPage formulario masivo sin step indicator** — 13 campos, 5 secciones, sin progreso visual
3. **Foto upload UX separada del form** — Crear animal sin fotos, luego redirect, luego upload
4. **Validaciones page approve error persiste** — No desaparece si retry funciona
5. **SuperAdminPage form inline sin estructura** — Difícil en mobile

## The Ugly 🟡 (SHOULD FIX)
- ImportPage table sin sticky header (scroll pierde headers)
- AnimalFormPage genealogy query sin loading spinner
- AnimalFormPage madre-lote select vacío cuando cargando
- CandidatosReproductorPage expand patrón requiere 2 clicks
- ReportesPage sin cancel option para jobs
- Modales sin focus trap + role="dialog"

## Accessibility Gaps
- ❌ aria-live en error messages
- ❌ Modal focus trap (Tab escapa)
- ❌ Table headers without scope="col"
- ❌ role="dialog" on modals

## Quick Wins (1-2 hours each)
| Fix | Impact | Effort |
|-----|--------|--------|
| Auto-dismiss errors | HIGH | 30 min |
| Sticky table header | MEDIUM | 15 min |
| Success toast on approve | MEDIUM | 1 h |
| Error Alert component | MEDIUM | 30 min |
| Modal focus trap | HIGH (a11y) | 1.5 h |

## Priority Matrix
```
CRITICAL (Sprint 1 — ASAP)
├─ Auto-dismiss errors (SociosPage, SuperAdminPage, DocumentosPage)
├─ AnimalFormPage step indicator
├─ Modal focus trap + aria-live
└─ Success feedback on actions

IMPORTANT (Sprint 2)
├─ SuperAdminPage modal form
├─ CandidatosPage quick actions
├─ Genealogy loading states
└─ Table sticky headers

NICE-TO-HAVE (Sprint 3+)
├─ Form field validation bubbles
├─ Keyboard shortcut hints
└─ Advanced filtering UX
```

## Code Files to Modify

### Critical Path
1. **SociosPage.tsx** (línea 177-180) — Add error auto-dismiss
2. **SuperAdminPage.tsx** (línea 76-117) — Move form to modal
3. **ValidacionesPage.tsx** (línea 27-29) — Add success toast
4. **AnimalFormPage.tsx** (línea 256) — Add step indicator
5. **Todos modales** — Add focus-trap + role="dialog"

### New Components to Create
1. `useAutoCloseError.ts` (hook)
2. `ErrorAlert.tsx` (reusable alert)
3. `Modal.tsx` (focus-trap wrapper)
4. `FormStepIndicator.tsx` (step tabs)
5. `TenantModal.tsx` (for SuperAdmin)

## Metrics
- **Lines of code to change:** ~400
- **New components:** 5
- **Estimated hours:** 8-10
- **Payoff:** Error handling consistency + accessibility + mobile UX

## Next Steps
1. [ ] Pick 1-2 quick wins, implement in 1-2 hours
2. [ ] Schedule 1-day sprint for 5 critical fixes
3. [ ] Run accessibility audit (WAVE, Axe)
4. [ ] Test on mobile (iPhone 12, 390px)
5. [ ] QA: error flows, network throttling, focus management

---

## Role-by-Role Scores

### GESTIÓN (Admin, Desktop)
- **Overall:** 7.2/10
- **Strengths:** Dashboard tile KPIs, import wizard, validation flow
- **Weakness:** Error handling, SuperAdmin form layout

### SOCIO (Partner, Mobile)
- **Overall:** 7.8/10
- **Strengths:** Animal card design, photo upload UX, lote creation
- **Weakness:** Form length (AnimalFormPage), genealogy loading

### SUPERADMIN (Power User, Desktop)
- **Overall:** 7.0/10
- **Strengths:** Tenant list, stats grid
- **Weakness:** Inline form, no modal, color picker a11y

---

## Design System Observations

**What's Working:**
- Tailwind utilities consistent (px-4, py-2.5, etc.)
- Color semantics: red=danger, green=success, blue=primary
- Button variants (.btn-primary, .btn-secondary, .btn-danger)
- Icons: lucide-react, consistent sizes (16/18/20)

**What Needs Work:**
- No toast/notification library (using console.log for errors)
- No modal base component (every modal is hand-rolled)
- No form-level validation patterns (mix of react-hook-form + manual)
- Spacing inconsistency in some sections (gap-3 vs gap-4)

---

## Estimated Impact by Fix

| Fix | Users Affected | Pain Level | Payoff |
|-----|-----------------|-----------|--------|
| Auto-dismiss errors | All | Medium | High |
| Form step indicator | Mobile socio | High | High |
| Photo upload flow | Mobile socio | High | High |
| Error persistence | All | Medium | Medium |
| Modal focus trap | Keyboard users | High | High (a11y) |
| Sticky headers | Desktop | Low | Medium |

---

## Recommendation

**Do in this order:**
1. **This week:** Auto-dismiss errors (30 min) + Error Alert component (30 min)
2. **Next week:** Form step indicator (2h) + SuperAdmin modal (2h)
3. **Following week:** Accessibility sweep (focus trap, aria-live, role="dialog")

**Not urgent:**
- Dark mode
- Advanced filters
- Virtualization in long lists

---

## Final Verdict

AGAMUR is a **solid foundation** (7.5/10) that **feels unfinished** (missing polish). With 1 sprint of focused work on error handling + accessibility, it becomes **8.5/10 and truly production-ready**.

The issues are **solvable**, not architectural — mostly about **consistency** and **feedback loops**. No major refactoring needed.

