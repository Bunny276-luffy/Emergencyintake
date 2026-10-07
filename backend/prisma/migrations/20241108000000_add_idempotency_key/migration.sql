-- AlterTable
ALTER TABLE "incidents" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "incidents_idempotencyKey_key" ON "incidents"("idempotencyKey");
