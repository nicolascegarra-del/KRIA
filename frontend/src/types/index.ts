// ─── Tenant ──────────────────────────────────────────────────────────────────
export interface AnillaSize {
  mm: string;
  sexo?: "M" | "H" | "";
}

export interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  granjas_enabled: boolean;
  anilla_sizes: AnillaSize[];
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
  domicilio: string;
  municipio: string;
  codigo_postal: string;
  provincia: string;
  numero_cuenta: string;
  numero_socio: string;
  codigo_rega: string;
  fecha_alta: string | null;
  estado: "ALTA" | "BAJA";
  razon_baja: string;
  fecha_baja: string | null;
  email: string;
  full_name: string;
  has_portal_access: boolean;
  cuota_anual_pagada?: number | null;
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
export type AnimalEstado = "AÑADIDO" | "APROBADO" | "EVALUADO" | "RECHAZADO" | "SOCIO_EN_BAJA" | "BAJA";
export type AnimalSexo = "M" | "H";
export type AnimalVariedad = "SALMON" | "PLATA" | "SIN_DEFINIR";

export type FotoTipo = "PERFIL" | "CABEZA" | "ANILLA";

export interface MotivoBaja {
  id: string;
  nombre: string;
  is_active: boolean;
  orden: number;
}

export interface Animal {
  id: string;
  numero_anilla: string;
  fecha_nacimiento: string;
  sexo: AnimalSexo;
  variedad: AnimalVariedad;
  fecha_incubacion: string | null;
  ganaderia_nacimiento: string;
  estado: AnimalEstado;
  alerta_anilla: "FUERA_RANGO" | "DIAMETRO" | "" | null;
  razon_rechazo: string;
  fecha_baja: string | null;
  motivo_baja: string | null;
  motivo_baja_nombre: string | null;
  candidato_reproductor: boolean;
  reproductor_aprobado: boolean;
  socio: string;
  socio_nombre: string;
  padre: string | null;
  padre_anilla: string | null;
  padre_anio_nacimiento: number | null;
  madre_animal: string | null;
  madre_anilla: string | null;
  madre_anio_nacimiento: number | null;
  madre_lote: string | null;
  madre_lote_externo: string;
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
  socio: string;
  macho: string | null;
  macho_anilla: string | null;
  hembras: string[];
  hembras_anillas: string[];
  crias_count: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  is_closed: boolean;
  created_at: string;
}

// ─── Genealogy ────────────────────────────────────────────────────────────────
export interface GenealogyNode {
  id: string;
  anilla: string;
  anio: number;
  sexo: string | null;
  variedad: string | null;
  estado: string | null;
  tipo?: "ANIMAL" | "LOTE" | "LOTE_EXTERNO";
  padre?: GenealogyNode | null;
  madre?: GenealogyNode | null;
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
  candidatos_reproductor: number;
  alertas_anilla: number;
  solicitudes_realta: number;
}

// ─── Reproductores ────────────────────────────────────────────────────────────
export interface ReproductorAprobacion {
  aprobado: boolean;
  notas_decision?: string;
}

// ─── Import 2-phase ───────────────────────────────────────────────────────────
export interface ImportPreviewRow {
  fila: number;
  dni_nif: string;
  email: string;
  nombre_razon_social: string;
  errores: string[];
}

export interface ImportValidateResult {
  total_filas: number;
  filas_ok: number;
  filas_con_error: number;
  errores: { fila: number; errores: string[] }[];
  columnas_faltantes?: string[];
  preview: ImportPreviewRow[];
  temp_key: string;
}

// ─── Documento ────────────────────────────────────────────────────────────────
export type DocumentoTipo = "GENERAL" | "PARTICULAR";

export interface Documento {
  id: string;
  tipo: DocumentoTipo;
  socio: string | null;
  socio_nombre: string | null;
  nombre_archivo: string;
  content_type: string;
  tamanio_bytes: number;
  version: number;
  subido_por: string;
  subido_por_nombre: string | null;
  download_url: string | null;
  created_at: string;
}

// ─── Solicitud de Re-alta ─────────────────────────────────────────────────────
export type SolicitudRealtaEstado = "PENDIENTE" | "APROBADO" | "DENEGADO";

export interface SolicitudRealta {
  id: string;
  animal: string;
  animal_anilla?: string;
  animal_anio?: number;
  solicitante: string;
  solicitante_nombre?: string;
  estado: SolicitudRealtaEstado;
  notas: string;
  created_at: string;
  resolved_at: string | null;
}

// ─── Solicitud de cambio de datos ─────────────────────────────────────────────
export interface SolicitudCambioDatos {
  id: string;
  socio_id: string;
  socio_nombre: string;
  socio_numero: string;
  datos_propuestos: Record<string, string>;
  datos_actuales: Record<string, string>;
  estado: "PENDIENTE" | "APROBADO" | "DENEGADO";
  created_at: string;
}

// ─── Notificacion ─────────────────────────────────────────────────────────────
export interface Notificacion {
  id: string;
  tipo: "ANIMAL_APROBADO" | "ANIMAL_RECHAZADO" | "REALTA_APROBADA" | "REALTA_DENEGADA" | "REPRODUCTOR_APROBADO" | "REPRODUCTOR_DENEGADO" | "CAMBIO_DATOS_APROBADO" | "CAMBIO_DATOS_DENEGADO" | "CUOTA_PENDIENTE";
  animal_id: string;
  animal_anilla: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

// ─── Tenant (SuperAdmin) ──────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  logo_url: string | null;
  max_socios: number;
  socios_count?: number;  // anotado por el backend, solo lectura
  // Datos de contacto opcionales
  nombre_completo?: string;
  cif?: string;
  domicilio?: string;
  email_asociacion?: string;
  telefono1?: string;
  telefono1_nombre?: string;
  telefono1_cargo?: string;
  telefono2?: string;
  telefono2_nombre?: string;
  telefono2_cargo?: string;
  // Features
  granjas_enabled?: boolean;
  anilla_sizes?: AnillaSize[];
  email_notificaciones?: string;
  // SMTP por asociación
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_use_tls?: boolean;
  smtp_use_ssl?: boolean;
}

// ─── Platform Settings ────────────────────────────────────────────────────────
export interface PlatformSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  inactivity_timeout_minutes: number;
}

// ─── Impersonation ────────────────────────────────────────────────────────────
export interface ImpersonationTarget {
  id: string;
  name: string;
  slug: string;
}

export interface ImpersonateResponse {
  access: string;
  tenant: ImpersonationTarget;
}

export interface GestionUserCreate {
  email: string;
  first_name?: string;
  last_name?: string;
  password: string;
}

export interface GestionUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  notif_nueva_asociacion?: boolean;
  notif_asociacion_suspendida?: boolean;
  notif_asociacion_activada?: boolean;
  notif_asociacion_eliminada?: boolean;
}

export interface TenantCreatePayload extends Partial<Tenant> {
  gestion_user?: GestionUserCreate;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
