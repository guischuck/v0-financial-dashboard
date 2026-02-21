-- CreateTable
CREATE TABLE "client_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "payer_cpf" TEXT NOT NULL,
    "advbox_customer_id" INTEGER NOT NULL,
    "advbox_customer_name" TEXT,
    "advbox_customer_identification" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pluggy_transaction_db_id" TEXT NOT NULL,
    "advbox_transaction_id" INTEGER NOT NULL,
    "advbox_customer_id" INTEGER,
    "match_score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_mappings_tenant_id_idx" ON "client_mappings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_mappings_tenant_id_payer_cpf_key" ON "client_mappings"("tenant_id", "payer_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_records_pluggy_transaction_db_id_key" ON "reconciliation_records"("pluggy_transaction_db_id");

-- CreateIndex
CREATE INDEX "reconciliation_records_tenant_id_idx" ON "reconciliation_records"("tenant_id");

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_pluggy_transaction_db_id_fkey" FOREIGN KEY ("pluggy_transaction_db_id") REFERENCES "pluggy_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
