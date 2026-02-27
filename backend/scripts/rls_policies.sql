-- PostgreSQL Row-Level Security policies for AGAMUR
-- Applied as a secondary isolation layer after Django's TenantManager
-- Run once after migrations: psql $DATABASE_URL < rls_policies.sql

-- ── Enable RLS on all tenant-aware tables ────────────────────────────────────
ALTER TABLE animals_animal ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_socio ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_evaluacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts_conflicto ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports_importjob ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_reportjob ENABLE ROW LEVEL SECURITY;

-- ── Tenant isolation policy (uses current_setting set by app) ─────────────────
-- Django sets app.current_tenant_id via a session variable before queries.
-- Superadmins bypass RLS (BYPASSRLS role or direct superuser).

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_tenant_id', true), ''),
    '00000000-0000-0000-0000-000000000000'
  )::uuid;
$$ LANGUAGE sql STABLE;

-- Animals
CREATE POLICY tenant_isolation ON animals_animal
  USING (tenant_id = current_tenant_id());

-- Socios
CREATE POLICY tenant_isolation ON accounts_socio
  USING (tenant_id = current_tenant_id());

-- Lotes
CREATE POLICY tenant_isolation ON lotes_lote
  USING (tenant_id = current_tenant_id());

-- Evaluaciones
CREATE POLICY tenant_isolation ON evaluaciones_evaluacion
  USING (tenant_id = current_tenant_id());

-- Conflictos
CREATE POLICY tenant_isolation ON conflicts_conflicto
  USING (tenant_id = current_tenant_id());

-- Import jobs
CREATE POLICY tenant_isolation ON imports_importjob
  USING (tenant_id = current_tenant_id());

-- Report jobs
CREATE POLICY tenant_isolation ON reports_reportjob
  USING (tenant_id = current_tenant_id());

-- ── Admin/superuser bypass ────────────────────────────────────────────────────
-- The Django service user should NOT have BYPASSRLS by default.
-- Grant BYPASSRLS only to the dedicated admin maintenance user.
-- ALTER ROLE agamur_admin BYPASSRLS;
