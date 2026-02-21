-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "entity_type" TEXT,
ADD COLUMN     "user_name" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
