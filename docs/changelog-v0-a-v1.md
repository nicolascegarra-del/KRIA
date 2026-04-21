# Control de Cambios — KRIA Versión 0 → Versión 1

**Fecha de redacción:** 21 de abril de 2026  
**Rama de producción actual:** `KRIA/Version-0`  
**Rama en desarrollo:** `KRIA/Version-1`

---

## Resumen ejecutivo

La Versión 1 incorpora tres bloques de mejora sobre la base de la Versión 0: un nuevo módulo de tablas de control configurables, la capacidad de importar socios y animales directamente desde el panel del SuperAdmin, y mejoras en la generación de reportes tanto para gestores como para socios.

---

## 1. Módulo de Tablas de Control

**Descripción**

Nuevo módulo opcional que permite a cada asociación crear tablas de control personalizadas para gestionar información de sus socios de forma estructurada (por ejemplo: «Libretas año 2026», «Control de pagos», etc.).

**Funcionalidades incluidas**

- Activación/desactivación del módulo por asociación desde el panel SuperAdmin, mediante el flag `tablas_enabled`.
- Creación de múltiples tablas por asociación, cada una con nombre propio.
- Configuración de cada tabla al crearla:
  - Campos del socio a mostrar como columnas (número de socio, nombre, DNI, email, teléfono, etc.).
  - Columnas de control propias, con tipos: **checkbox**, **texto**, **fecha** o **número**.
- Todos los socios de la asociación aparecen como filas de la tabla.
- Edición de celdas directamente en la tabla (inline) con guardado automático.
- Filtros por nombre/DNI/número de socio y por estado (Alta/Baja).
- Ordenación por columnas de socio.
- Exportación de la tabla a **PDF** (formato A4 apaisado) y a **Excel**.
- Botón «Sincronizar» para incorporar a la tabla los socios dados de alta después de su creación.

---

## 2. Importaciones desde el Panel SuperAdmin

**Descripción**

El SuperAdmin puede ahora realizar importaciones masivas de socios y animales en nombre de cualquier asociación directamente desde su panel, sin necesidad de acceder al panel de esa asociación ni usar la funcionalidad de impersonación.

**Funcionalidades incluidas**

- Selección de la asociación destino antes de iniciar la importación.
- Descarga de la plantilla Excel correspondiente (socios o animales) para cada asociación.
- Validación previa del archivo antes de importar:
  - Vista de previsualización con el resultado fila a fila.
  - Detalle de errores encontrados antes de confirmar.
- Confirmación explícita antes de ejecutar la importación.
- Seguimiento en tiempo real del progreso del job de importación.

---

## 3. Mejoras en Reportes

### 3.1 Ordenación de PDFs de Inventario y Catálogo de Reproductores

Antes de generar un PDF de Inventario o de Catálogo de Reproductores, el sistema permite elegir el criterio de ordenación:

- Por Variedad → Nº de Anilla
- Por Socio → Nº de Anilla
- Por Estado → Nº de Anilla
- Solo por Nº de Anilla

### 3.2 Puntuación de evaluación en la Ficha Individual

Los animales en estado **EVALUADO** muestran ahora en su ficha PDF:

- Puntuación media obtenida en la evaluación morfológica.
- Fecha en que se realizó la evaluación.

Esta información aparece tanto en el banner de identificación del animal como en la sección de Evaluación Morfológica.

### 3.3 Nueva sección «Mis Reportes» para socios

Los socios disponen de una nueva sección en su panel desde la que pueden generar de forma autónoma:

- **Inventario propio en PDF**, con el mismo selector de ordenación disponible para gestores.
- **Inventario propio en Excel**.

---

## Notas técnicas para el equipo

| Componente | Cambio |
|---|---|
| `Tenant` | Nuevo campo `tablas_enabled` (Boolean, defecto `False`) |
| Nueva app `tablas` | Modelos, serializers, vistas y URLs del módulo de tablas |
| `imports/superadmin_views.py` | Endpoints de validación y confirmación de importaciones para SuperAdmin |
| `reports/tasks.py` y `views.py` | Soporte de criterio de ordenación en generación de PDFs |
| `reports/individual.html` | Puntuación y fecha de evaluación en ficha PDF |
| Frontend | Páginas `TablasPage`, `TablaDetallePage`, `MisReportesPage`; modal de ordenación en `ReportesPage`; sección de importaciones en `SuperAdminPage` |

---

*Documento generado automáticamente a partir del historial de la rama `KRIA/Version-1`.*
