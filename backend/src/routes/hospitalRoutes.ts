import { Router } from 'express';
import {
  getHospitalProfile,
  updateHospitalCapacity,
  getIncomingReservations,
  acceptReservation,
  rejectReservation,
  completeAdmission,
  generateHospitalPreArrivalSummaryAI,
} from '../controllers/hospitalController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/authHandler';

const router = Router();
const hospitalAuth = [authenticate, requireRole(['HOSPITAL', 'DISPATCHER', 'ADMIN'])];

// GET /api/hospital/:hospitalId/profile - Retrieve hospital profile & capacity
router.get('/:hospitalId/profile', hospitalAuth, asyncHandler(getHospitalProfile));

// PATCH /api/hospital/:hospitalId/capacity - Update hospital bed & ventilator capacity
router.patch('/:hospitalId/capacity', hospitalAuth, asyncHandler(updateHospitalCapacity));

// GET /api/hospital/:hospitalId/reservations - Retrieve incoming bed reservations
router.get('/:hospitalId/reservations', hospitalAuth, asyncHandler(getIncomingReservations));

// POST /api/hospital/:hospitalId/reservation/:reservationId/accept - Accept incoming patient reservation
router.post('/:hospitalId/reservation/:reservationId/accept', hospitalAuth, asyncHandler(acceptReservation));

// POST /api/hospital/:hospitalId/reservation/:reservationId/reject - Reject reservation with mandatory reason
router.post('/:hospitalId/reservation/:reservationId/reject', hospitalAuth, asyncHandler(rejectReservation));

// POST /api/hospital/:hospitalId/admission - Complete patient admission preparation
router.post('/:hospitalId/admission', hospitalAuth, asyncHandler(completeAdmission));

// GET /api/hospital/:hospitalId/incident/:incidentId/ai-summary - Gemini AI pre-arrival ER briefing summary
router.get('/:hospitalId/incident/:incidentId/ai-summary', hospitalAuth, asyncHandler(generateHospitalPreArrivalSummaryAI));

export default router;
