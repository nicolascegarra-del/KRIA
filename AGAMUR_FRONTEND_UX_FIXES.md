# AGAMUR Frontend — UX Fixes (Código Específico)

## Fix 1: Auto-Dismiss Error Messages (30 min)

### Problema
Errores persisten indefinidamente (SociosPage:177-180, SuperAdminPage:108, DocumentosPage:76-80)

### Solución A: Crear Hook Reutilizable

**Archivo:** `frontend/src/hooks/useAutoCloseError.ts`

```typescript
import { useEffect } from 'react';

export function useAutoCloseError(
  error: string | null,
  onClear: () => void,
  delayMs: number = 5000
) {
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(onClear, delayMs);
    return () => clearTimeout(timer);
  }, [error, onClear, delayMs]);
}
```

### Uso en SociosPage

**Antes (línea 44):**
```jsx
const [serverError, setServerError] = useState("");
```

**Después:**
```jsx
const [serverError, setServerError] = useState("");
useAutoCloseError(serverError, () => setServerError(""), 5000);
```

### Uso en SuperAdminPage

**Antes (línea 12):**
```jsx
const [error, setError] = useState("");
```

**Después:**
```jsx
const [error, setError] = useState("");
useAutoCloseError(error, () => setError(""), 5000);
```

### Beneficios
- ✅ Centralizado (reutilizable en todas las páginas)
- ✅ Configurable (delay customizable)
- ✅ Auto-cleanup on unmount
- ✅ User puede cerrar manualmente añadiendo close button

---

## Fix 2: Error Message con Close Button

**Componente:** `frontend/src/components/ErrorAlert.tsx`

```jsx
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onClose: () => void;
}

export default function ErrorAlert({ message, onClose }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-red-500 hover:text-red-700 p-1"
        aria-label="Cerrar error"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

**Uso (reemplaza inline `<div className="bg-red-50...">`):**

```jsx
{serverError && (
  <ErrorAlert message={serverError} onClose={() => setServerError("")} />
)}
```

---

## Fix 3: AnimalFormPage — Step Indicator (2 horas)

### Problema
Form masivo (13 campos, 5 secciones) sin indicación visual de progreso

### Solución: Sticky Section Tabs

**Componente:** `frontend/src/components/FormStepIndicator.tsx`

```jsx
import { useState } from 'react';

interface FormStep {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface FormStepIndicatorProps {
  steps: FormStep[];
  currentStep: string;
  onStepChange: (stepId: string) => void;
}

export default function FormStepIndicator({
  steps,
  currentStep,
  onStepChange,
}: FormStepIndicatorProps) {
  return (
    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10 shadow-sm">
      <div className="flex gap-2 overflow-x-auto">
        {steps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => onStepChange(step.id)}
            className={`
              px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium
              transition-colors flex items-center gap-2
              ${
                currentStep === step.id
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            {step.icon}
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Uso en AnimalFormPage (línea 256 reemplazar):**

```jsx
const [activeStep, setActiveStep] = useState('identification');

const steps = [
  { id: 'identification', label: 'Identificación' },
  { id: 'biological', label: 'Datos Biológicos' },
  { id: 'breeding', label: 'Datos de Cría' },
  { id: 'genealogy', label: 'Genealogía' },
  { id: 'farm', label: 'Granja' },
];

return (
  <>
    <FormStepIndicator
      steps={steps}
      currentStep={activeStep}
      onStepChange={setActiveStep}
    />

    <div className="max-w-2xl space-y-4">
      {/* Resto del form igual, pero wrappear cada sección */}
      {activeStep === 'identification' && (
        <div className="card space-y-5">
          {/* Identification form fields */}
        </div>
      )}
      {/* ... repeat para otros steps ... */}
    </div>
  </>
);
```

---

## Fix 4: AnimalFormPage — Genealogy Loading State (1 hora)

**Problema:** Genealogy query carga sin visual feedback

**Solución (línea 65-69 AnimalFormPage):**

**Antes:**
```jsx
const { data: genealogy } = useQuery({
  queryKey: ["genealogy", id],
  queryFn: () => animalsApi.genealogy(id!),
  enabled: isEdit && showGenealogia,
});
```

**Después:**
```jsx
const { data: genealogy, isLoading: isLoadingGenealogy } = useQuery({
  queryKey: ["genealogy", id],
  queryFn: () => animalsApi.genealogy(id!),
  enabled: isEdit && showGenealogia,
});

// Línea 491-494 reemplazar:
{showGenealogia && (
  <div className="mt-3 overflow-x-auto">
    {isLoadingGenealogy ? (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        Cargando árbol genealógico...
      </div>
    ) : genealogy?.tree ? (
      <GenealogyTooltip tree={genealogy.tree} width={480} height={280} />
    ) : (
      <p className="text-sm text-gray-500">No hay datos genealógicos disponibles.</p>
    )}
  </div>
)}
```

---

## Fix 5: AnimalFormPage — Madre Mode Loading (1 hora)

**Problema:** Si madreMode=lote y lotesData loading, select vacío sin feedback

**Solución (línea 410-425 AnimalFormPage):**

**Antes:**
```jsx
) : (
  <select
    className="input-field"
    value={madreLoteId}
    onChange={(e) => setMadreLoteId(e.target.value)}
  >
    <option value="">Sin lote asignado</option>
    {(lotesData?.results ?? []).map((lote) => (
      <option key={lote.id} value={lote.id}>
        {lote.nombre}
        {lote.is_closed ? " (Finalizado)" : ""}
        {lote.macho_anilla ? ` — Macho: ${lote.macho_anilla}` : ""}
      </option>
    ))}
  </select>
)}
```

**Después:**
```jsx
) : isLoadingLotes ? (
  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-500">
    <Loader2 size={14} className="animate-spin" />
    Cargando lotes...
  </div>
) : (
  <select
    className="input-field"
    value={madreLoteId}
    onChange={(e) => setMadreLoteId(e.target.value)}
  >
    <option value="">Sin lote asignado</option>
    {(lotesData?.results ?? []).map((lote) => (
      <option key={lote.id} value={lote.id}>
        {lote.nombre}
        {lote.is_closed ? " (Finalizado)" : ""}
        {lote.macho_anilla ? ` — Macho: ${lote.macho_anilla}` : ""}
      </option>
    ))}
  </select>
)}
```

Añadir `isLoadingLotes` a línea 76-79:
```jsx
const { data: lotesData, isLoading: isLoadingLotes } = useQuery({
  queryKey: ["lotes"],
  queryFn: lotesApi.list,
  enabled: madreMode === "lote",
});
```

---

## Fix 6: ValidacionesPage — Success Toast (1 hora)

**Problema:** Approve success no tiene feedback visual

**Solución:** Añadir Toast library (sonner es más moderno)

**Instalar:**
```bash
npm install sonner
```

**Usar en ValidacionesPage (línea 27-29):**

```jsx
import { toast } from 'sonner';

const approveMutation = useMutation({
  mutationFn: (id: string) => {
    setApprovingId(id);
    setApproveErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    return animalsApi.approve(id);
  },
  onSuccess: (data, id) => {
    setApprovingId(null);
    toast.success(`Animal ${data.numero_anilla} aprobado correctamente`);
    qc.invalidateQueries({ queryKey: ["animals"] });
  },
  onError: (err: any, id: string) => {
    setApprovingId(null);
    const msg =
      err?.response?.data?.detail ??
      "Error al aprobar el animal. Comprueba que tiene las 3 fotos obligatorias.";
    setApproveErrors((prev) => ({ ...prev, [id]: msg }));
    toast.error(msg);
  },
});
```

---

## Fix 7: ImportPage — Sticky Table Header (15 min)

**Problema:** Preview table header desaparece al scroll

**Solución (línea 197-227 ImportPage):**

**Antes:**
```jsx
<div className="overflow-x-auto">
  <table className="w-full text-xs text-left border-collapse">
    <thead>
      <tr className="bg-gray-50 border-b border-gray-200">
```

**Después:**
```jsx
<div className="overflow-x-auto">
  <table className="w-full text-xs text-left border-collapse">
    <thead className="sticky top-0 bg-white z-10 shadow-sm">
      <tr className="bg-gray-50 border-b border-gray-200">
```

---

## Fix 8: SuperAdminPage — Modal Form (2 horas)

**Problema:** Form inline sin estructura

**Solución:** Mover form a modal similar a SociosPage

**Código a cambiar (línea 76-117 SuperAdminPage):**

**Crear componente:** `frontend/src/components/TenantModal.tsx`

```jsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { superadminApi } from '../api/superadmin';
import { X, Loader2, Check } from 'lucide-react';
import type { Tenant } from '../types';

interface TenantModalProps {
  mode: 'create' | 'edit';
  tenant?: Tenant | null;
  onClose: () => void;
}

export default function TenantModal({ mode, tenant, onClose }: TenantModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: tenant?.name ?? '',
    slug: tenant?.slug ?? '',
    primary_color: tenant?.primary_color ?? '#1565C0',
    secondary_color: tenant?.secondary_color ?? '#FBC02D',
    is_active: tenant?.is_active ?? true,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: superadminApi.createTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al crear la asociación."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Tenant> }) =>
      superadminApi.updateTenant(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-tenants"] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.detail ?? "Error al actualizar."),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'edit' && tenant) {
      updateMutation.mutate({ id: tenant.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? 'Nueva asociación' : 'Editar asociación'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              className="input-field"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (código único)</label>
            <input
              type="text"
              className="input-field font-mono"
              value={form.slug}
              onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
              disabled={mode === 'edit'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color primario</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                className="input-field flex-1 font-mono"
                value={form.primary_color}
                onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color secundario</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.secondary_color}
                onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                className="input-field flex-1 font-mono"
                value={form.secondary_color}
                onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            Asociación activa
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              ) : (
                mode === 'create' ? 'Crear' : 'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**En SuperAdminPage reemplazar línea 9-11:**

```jsx
const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
const [showModal, setShowModal] = useState(false);

// Línea 76-117 eliminar, reemplazar con:
{showModal && (
  <TenantModal
    mode={editingTenant ? 'edit' : 'create'}
    tenant={editingTenant}
    onClose={() => {
      setShowModal(false);
      setEditingTenant(null);
    }}
  />
)}

// Botones para abrir modal:
<button onClick={() => { setEditingTenant(null); setShowModal(true); }} className="btn-primary gap-2">
  <Plus size={16} />Nueva asociación
</button>

// En tabla, reemplazar línea 154:
<button onClick={() => { setEditingTenant(t); setShowModal(true); }} className="text-blue-700 hover:text-blue-900">
  <Edit2 size={15} />
</button>
```

---

## Fix 9: Modales — Focus Trap + role="dialog" (1.5 horas)

**Instalar library:**
```bash
npm install focus-trap-react
```

**Crear componente reutilizable:** `frontend/src/components/Modal.tsx`

```jsx
import { ReactNode, useRef, useEffect } from 'react';
import FocusTrap from 'focus-trap-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, actions }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <FocusTrap
        focusTrapOptions={{
          onDeactivate: onClose,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="bg-white rounded-xl shadow-xl w-full max-w-md"
        >
          <div className="px-5 py-4 border-b">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>

          <div className="p-5">
            {children}
          </div>

          {actions && (
            <div className="flex gap-3 px-5 pb-5">
              {actions}
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}
```

**Usar en RejectModal (ValidacionesPage línea 120):**

```jsx
{rejectModal && (
  <Modal
    isOpen={true}
    onClose={() => setRejectModal(null)}
    title="Rechazar Animal"
    actions={
      <>
        <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button
          onClick={() => rejectMutation.mutate({ id: rejectModal.id, razon: razonRechazo })}
          disabled={!razonRechazo.trim() || rejectMutation.isPending}
          className="btn-danger flex-1"
        >
          {rejectMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Rechazar"
          )}
        </button>
      </>
    }
  >
    <p className="text-sm text-gray-600">
      Animal: <strong>{rejectModal.numero_anilla}</strong> / {rejectModal.anio_nacimiento}
    </p>
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Razón de rechazo *
      </label>
      <textarea
        className="input-field h-24 resize-none"
        value={razonRechazo}
        onChange={(e) => setRazonRechazo(e.target.value)}
        placeholder="Describe el motivo del rechazo..."
      />
    </div>
  </Modal>
)}
```

---

## Fix 10: SociosPage — Debounce Search (30 min)

**Problema:** Search sin debounce → multiple requests mientras typing

**Solución (línea 210-213 SociosPage):**

**Crear hook:** `frontend/src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

**En SociosPage reemplazar línea 210-213:**

```jsx
const debouncedSearch = useDebounce(search, 500);

const { data, isLoading } = useQuery({
  queryKey: ["socios", debouncedSearch],
  queryFn: () => sociosApi.list({ search: debouncedSearch }),
});
```

---

## Resumen de Esfuerzos

| Fix | Componentes | Esfuerzo | Archivos a Crear/Cambiar |
|-----|-------------|----------|-------------------------|
| 1   | Auto-dismiss errors | 30 min | Hook + uso en 3 páginas |
| 2   | Error Alert component | 30 min | 1 componente nuevo |
| 3   | Form Step Indicator | 2 h | 1 componente + AnimalFormPage |
| 4   | Genealogy loading | 1 h | AnimalFormPage |
| 5   | Madre mode loading | 1 h | AnimalFormPage |
| 6   | Success toast | 1 h | ValidacionesPage + sonner |
| 7   | Sticky header | 15 min | ImportPage |
| 8   | TenantModal | 2 h | Modal component + SuperAdminPage |
| 9   | Focus trap + role | 1.5 h | Modal wrapper + 5 páginas |
| 10  | Debounce search | 30 min | Hook + SociosPage |

**Total Estimado: 9.5 horas** (puede reducirse a 6-7 horas con work en paralelo)

---

## Testing Checklist

- [ ] Auto-dismiss: error desaparece a los 5s, user puede cerrar antes
- [ ] Step indicator: tabs clickeables, highlight correcto, scroll mobile ok
- [ ] Genealogy loading: spinner muestra mientras isLoadingGenealogy, desaparece cuando data llega
- [ ] Modal focus: Tab no escapa del modal, Escape cierra, first input autofocused
- [ ] Search debounce: typing "john" → solo 1 request (no 4)
- [ ] Success toast: approve → verde toast aparece 2s
- [ ] Sticky header: scroll tabla → header permanece visible

