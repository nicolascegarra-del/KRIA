// ─── Tenant ──────────────────────────────────────────────────────────────────
export interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_gestion: boolean;
  is_superadmin: boolean;
  tenant_id: string;
  tenant_slug: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

// ─── Socio ────────────────────────────────────────────────────────────────────
export interface Socio {
  id: string;
  nombre_razon_social: string;
  dni_nif: string;
  telefono: string;
  direccion: string;
  numero_socio: string;
  codigo_rega: string;
  estado: "ALTA" | "BAJA";
  razon_baja: string;
  fecha_baja: string | null;
  email: string;
  full_name: string;
}

// ─── Granja ───────────────────────────────────────────────────────────────────
export interface Granja {
  id: string;
  socio: string;
  socio_nombre?: string;
  nombre: string;
  codigo_rega: string;
  created_at: string;
}

// ─── Animal ───────────────────────────────────────────────────────────────────
export type AnimalEstado = "AÑADIDO" | "APROBADO" | "EVALUADO" | "RECHAZADO" | "SOCIO_EN_BAJA";
export type AnimalSexo = "M" | "H";
export type AnimalVariedad = "SALMON" | "PLATA" | "OTRA";

export type FotoTipo = "PERFIL" | "CABEZA" | "ANILLA";

export interface Animal {
  id: string;
  numero_anilla: string;
  anio_nacimiento: number;
  sexo: AnimalSexo;
  variedad: AnimalVariedad;
  fecha_incubacion: string | null;
  ganaderia_nacimiento: string;
  ganaderia_actual: string;
  estado: AnimalEstado;
  razon_rechazo: string;
  candidato_reproductor: boolean;
  reproductor_aprobado: boolean;
  socio_nombre: string;
  padre: string | null;
  padre_anilla: string | null;
  madre_animal: string | null;
  madre_anilla: string | null;
  madre_lote: string | null;
  granja: string | null;
  granja_nombre: string | null;
  fotos: PhotoEntry[];
  historico_pesos: WeightEntry[];
  created_at: string;
  updated_at: string;
}

export interface PhotoEntry {
  tipo: FotoTipo | null;
  url: string;
  key: string;
  uploaded_at: string;
}

export interface WeightEntry {
  fecha: string;
  peso: number;
  usuario?: string;
}

// ─── Lote ─────────────────────────────────────────────────────────────────────
export interface Lote {
  id: string;
  nombre: string;
  macho: string | null;
  hembras: string[];
  fecha_inicio: string;
  fecha_fin: string | null;
  is_closed: boolean;
}

// ─── Evaluacion ───────────────────────────────────────────────────────────────
export interface Evaluacion {
  id: string;
  animal: string;
  animal_anilla: string;
  cabeza: number;
  cola: number;
  pecho_abdomen: number;
  muslos_tarsos: number;
  cresta_babilla: number;
  color: number;
  puntuacion_media: string;
  notas: string;
  created_at: string;
}

// ─── Conflicto ────────────────────────────────────────────────────────────────
export interface Conflicto {
  id: string;
  numero_anilla: string;
  anio_nacimiento: number;
  socio_reclamante: string;
  socio_reclamante_nombre: string;
  socio_actual: string;
  socio_actual_nombre: string;
  estado: "PENDIENTE" | "RESUELTO" | "DESCARTADO";
  notas: string;
  created_at: string;
}

// ─── Import Job ───────────────────────────────────────────────────────────────
export interface ImportJob {
  id: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  result_summary: {
    total_rows?: number;
    created?: number;
    updated?: number;
    errors?: string[];
  };
  error_log: string;
  created_at: string;
  finished_at: string | null;
}

// ─── Report Job ───────────────────────────────────────────────────────────────
export interface ReportJob {
  id: string;
  report_type: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  download_url?: string;
  created_at: string;
  finished_at: string | null;
  error_log?: string | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  pendientes_aprobacion: number;
  conflictos_pendientes: number;
  imports_pendientes: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
