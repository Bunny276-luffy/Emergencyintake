-- CreateTable
CREATE TABLE "ml_eta_predictions" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "predictedEtaMinutes" DOUBLE PRECISION NOT NULL,
    "lowerBound" DOUBLE PRECISION NOT NULL,
    "upperBound" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_eta_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_eta_predictions_incidentId_key" ON "ml_eta_predictions"("incidentId");

-- AddForeignKey
ALTER TABLE "ml_eta_predictions" ADD CONSTRAINT "ml_eta_predictions_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ml_eta_predictions" ADD CONSTRAINT "ml_eta_predictions_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
