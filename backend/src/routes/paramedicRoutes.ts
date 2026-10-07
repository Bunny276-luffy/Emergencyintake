import { Router } from 'express';
import {
  getAssignedIncident,
  submitClinicalReport,
  getClinicalReport,
  updateClinicalReport,
  structureVoiceReportAI,
} from '../controllers/paramedicController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/authHandler';

const router = Router();
const paramedicAuth = [authenticate, requireRole(['PARAMEDIC', 'DISPATCHER', 'ADMIN'])];

// GET /api/paramedic/incident/:incidentId - Retrieve assigned incident & patient information
router.get('/incident/:incidentId', paramedicAuth, asyncHandler(getAssignedIncident));

// POST /api/paramedic/report - Submit patient assessment and vitals from Paramedic Team
router.post('/report', paramedicAuth, asyncHandler(submitClinicalReport));

// GET /api/paramedic/report/:incidentId - Retrieve current clinical report for an incident
router.get('/report/:incidentId', paramedicAuth, asyncHandler(getClinicalReport));

// PATCH /api/paramedic/report/:reportId - Update report when additional observations are made
router.patch('/report/:reportId', paramedicAuth, asyncHandler(updateClinicalReport));

// POST /api/paramedic/ai/structure-report - Gemini AI voice report & clinical note structuring
router.post('/ai/structure-report', paramedicAuth, asyncHandler(structureVoiceReportAI));

export default router;
