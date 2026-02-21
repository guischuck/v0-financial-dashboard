-- Composite index: transactions by tenant + date + type (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_pluggy_tx_tenant_date_type"
  ON "pluggy_transactions" ("tenant_id", "date" DESC, "type");

-- Composite index: transactions by tenant + account + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_pluggy_tx_tenant_account_date"
  ON "pluggy_transactions" ("tenant_id", "pluggy_account_db_id", "date" DESC);

-- Composite index: reconciliation records by tenant + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_recon_tenant_status"
  ON "reconciliation_records" ("tenant_id", "status");

-- Composite index: audit logs by tenant + created_at for recent queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_tenant_created"
  ON "audit_logs" ("tenant_id", "created_at" DESC);

-- Composite index: client mappings by tenant + customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_client_mapping_tenant_customer"
  ON "client_mappings" ("tenant_id", "advbox_customer_id");

-- Materialized view for dashboard KPIs (aggregated by tenant/month/type)
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_tenant_kpis" AS
SELECT
  "tenant_id",
  date_trunc('month', "date") AS "month",
  "type",
  COUNT(*)::int AS "tx_count",
  COALESCE(SUM("amount"), 0) AS "total_amount",
  COALESCE(AVG("amount"), 0) AS "avg_amount",
  COUNT(*) FILTER (WHERE "ignored" = false)::int AS "active_tx_count",
  COALESCE(SUM("amount") FILTER (WHERE "ignored" = false), 0) AS "active_total_amount"
FROM "pluggy_transactions"
GROUP BY "tenant_id", date_trunc('month', "date"), "type";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mv_kpis_tenant_month_type"
  ON "mv_tenant_kpis" ("tenant_id", "month", "type");
