-- CreateTable
CREATE TABLE "ml_triage_predictions" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "severityRecommendation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "safetyEscalation" BOOLEAN NOT NULL,
    "topFactors" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_triage_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_triage_predictions_incidentId_key" ON "ml_triage_predictions"("incidentId");

-- AddForeignKey
ALTER TABLE "ml_triage_predictions" ADD CONSTRAINT "ml_triage_predictions_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
