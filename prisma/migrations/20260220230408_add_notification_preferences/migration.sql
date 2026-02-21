-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "auto_mark_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notify_due_transactions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_misc" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_reconciliation" BOOLEAN NOT NULL DEFAULT true;
