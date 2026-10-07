-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Enums
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'DISPATCHED', 'PARAMEDIC_EN_ROUTE', 'PATIENT_PICKED_UP', 'TRANSPORTING', 'ARRIVED_AT_HOSPITAL', 'HANDOFF_COMPLETED', 'CANCELLED');
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'OUT_OF_SERVICE', 'MAINTENANCE');
CREATE TYPE "TriageLevel" AS ENUM ('IMMEDIATE_RED', 'URGENT_YELLOW', 'DELAYED_GREEN', 'EXPECTANT_BLACK');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'COMPLETED');
CREATE TYPE "ErrorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
CREATE TYPE "SystemErrorSource" AS ENUM ('PUBLIC_SOS', 'AMBULANCE_DRIVER', 'PARAMEDIC_TEAM', 'HOSPITAL', 'DISPATCH_CENTER', 'ADMIN_COMMAND_CENTER', 'DATABASE', 'API_GATEWAY', 'WEBSOCKET', 'AI_SERVICE', 'ROUTING_SERVICE', 'SYSTEM_CORE');

-- Create Hospitals table
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "contactNumber" TEXT NOT NULL,
    "totalBeds" INTEGER NOT NULL,
    "availableICUBeds" INTEGER NOT NULL,
    "availableEmergencyBeds" INTEGER NOT NULL,
    "availableVentilators" INTEGER NOT NULL,
    "traumaCenterLevel" INTEGER NOT NULL,
    "acceptingPatients" BOOLEAN NOT NULL DEFAULT true,
    "specialties" TEXT[] NOT NULL,
    "lastCapacityUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom" geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)) STORED
);

-- Create Ambulances table
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleNumber" TEXT NOT NULL UNIQUE,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "currentIncidentId" TEXT,
    "destinationHospitalId" TEXT,
    "etaSeconds" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom" geometry(Point, 4326) GENERATED ALWAYS AS (
        CASE 
            WHEN "longitude" IS NOT NULL AND "latitude" IS NOT NULL 
            THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
            ELSE NULL 
        END
    ) STORED
);

-- Create Incidents table
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emergencyType" TEXT NOT NULL,
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "description" TEXT NOT NULL,
    "reporterContact" TEXT,
    "assignedAmbulanceId" TEXT REFERENCES "ambulances"("id") ON DELETE SET NULL,
    "assignedParamedicId" TEXT,
    "destinationHospitalId" TEXT REFERENCES "hospitals"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geom" geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)) STORED
);

-- Create Paramedics table
CREATE TABLE "paramedics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Paramedic Reports table
CREATE TABLE "paramedic_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "paramedicId" TEXT NOT NULL REFERENCES "paramedics"("id") ON DELETE CASCADE,
    "patientConditionSummary" TEXT NOT NULL,
    "triageLevel" "TriageLevel" NOT NULL,
    "heartRate" INTEGER,
    "bloodPressureSystolic" INTEGER,
    "bloodPressureDiastolic" INTEGER,
    "oxygenSaturation" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "temperatureCelsius" DOUBLE PRECISION,
    "glasgowComaScale" INTEGER,
    "voiceReportAudioUrl" TEXT,
    "transcriptionText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Patients table
CREATE TABLE "patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "knownMedicalConditions" TEXT[] NOT NULL,
    "allergies" TEXT[] NOT NULL,
    "bloodType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Reservations table
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "hospitalId" TEXT NOT NULL REFERENCES "hospitals"("id") ON DELETE CASCADE,
    "bedType" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL
);

-- Create System Errors table for Admin Command Center
CREATE TABLE "system_errors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" "ErrorSeverity" NOT NULL,
    "source" "SystemErrorSource" NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "errorCode" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "details" JSONB,
    "incidentId" TEXT,
    "ambulanceId" TEXT,
    "hospitalId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3)
);

-- Create Audit Logs table
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "who" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "incidentId" TEXT,
    "ambulanceId" TEXT,
    "hospitalId" TEXT,
    "metadata" JSONB
);

-- Spatial and Performance Indexes
CREATE INDEX idx_incidents_geom ON "incidents" USING GIST ("geom");
CREATE INDEX idx_incidents_status ON "incidents" ("status");
CREATE INDEX idx_ambulances_geom ON "ambulances" USING GIST ("geom");
CREATE INDEX idx_ambulances_status ON "ambulances" ("status");
CREATE INDEX idx_hospitals_geom ON "hospitals" USING GIST ("geom");
CREATE INDEX idx_hospitals_accepting ON "hospitals" ("acceptingPatients");
CREATE INDEX idx_system_errors_severity ON "system_errors" ("severity");
CREATE INDEX idx_system_errors_source ON "system_errors" ("source");
CREATE INDEX idx_audit_logs_timestamp ON "audit_logs" ("timestamp");
