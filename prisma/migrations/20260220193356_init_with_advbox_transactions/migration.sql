-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pluggy_api_key_enc" TEXT,
    "pluggy_client_id_enc" TEXT,
    "advbox_api_key_enc" TEXT,
    "advbox_api_url" TEXT,
    "pluggy_webhook_url" TEXT,
    "pluggy_connected" BOOLEAN NOT NULL DEFAULT false,
    "advbox_connected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pluggy_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "connector_id" INTEGER,
    "connector_name" TEXT,
    "status" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pluggy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pluggy_accounts" (
    "id" TEXT NOT NULL,
    "pluggy_item_db_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "number" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'BRL',
    "bank_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pluggy_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pluggy_transactions" (
    "id" TEXT NOT NULL,
    "pluggy_account_db_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description_raw" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "category_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION,
    "currency_code" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT,
    "merchant" JSONB,
    "credit_card_metadata" JSONB,
    "payment_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pluggy_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pluggy_webhooks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pluggy_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenant_id_clerk_user_id_key" ON "tenant_users"("tenant_id", "clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pluggy_items_item_id_key" ON "pluggy_items"("item_id");

-- CreateIndex
CREATE INDEX "pluggy_items_tenant_id_idx" ON "pluggy_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pluggy_accounts_account_id_key" ON "pluggy_accounts"("account_id");

-- CreateIndex
CREATE INDEX "pluggy_accounts_tenant_id_idx" ON "pluggy_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "pluggy_accounts_pluggy_item_db_id_idx" ON "pluggy_accounts"("pluggy_item_db_id");

-- CreateIndex
CREATE UNIQUE INDEX "pluggy_transactions_transaction_id_key" ON "pluggy_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "pluggy_transactions_tenant_id_idx" ON "pluggy_transactions"("tenant_id");

-- CreateIndex
CREATE INDEX "pluggy_transactions_pluggy_account_db_id_idx" ON "pluggy_transactions"("pluggy_account_db_id");

-- CreateIndex
CREATE INDEX "pluggy_transactions_date_idx" ON "pluggy_transactions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "pluggy_webhooks_webhook_id_key" ON "pluggy_webhooks"("webhook_id");

-- CreateIndex
CREATE INDEX "pluggy_webhooks_tenant_id_idx" ON "pluggy_webhooks"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pluggy_items" ADD CONSTRAINT "pluggy_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pluggy_accounts" ADD CONSTRAINT "pluggy_accounts_pluggy_item_db_id_fkey" FOREIGN KEY ("pluggy_item_db_id") REFERENCES "pluggy_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pluggy_transactions" ADD CONSTRAINT "pluggy_transactions_pluggy_account_db_id_fkey" FOREIGN KEY ("pluggy_account_db_id") REFERENCES "pluggy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
