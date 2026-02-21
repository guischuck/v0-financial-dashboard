-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "confidence_high" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "confidence_medium" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "match_weight_amount" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "match_weight_cpf" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "match_weight_email" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "match_weight_name" INTEGER NOT NULL DEFAULT 25;
