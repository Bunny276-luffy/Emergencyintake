import { Router } from 'express';
import {
  getAmbulanceAssignment,
  getAmbulanceStatus,
  updateAmbulanceLocation,
  updateAmbulanceStatus,
  acknowledgeAssignment,
  reportPatientArrival,
  reportPatientDeparture,
  reportHospitalArrival,
  completeHandoff,
} from '../controllers/ambulanceController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/authHandler';

const router = Router();
const ambulanceAuth = [authenticate, requireRole(['AMBULANCE_DRIVER', 'DISPATCHER', 'ADMIN'])];

// GET /api/ambulance/:ambulanceId/assignment - Retrieve active assignment for ambulance driver
router.get('/:ambulanceId/assignment', ambulanceAuth, asyncHandler(getAmbulanceAssignment));

// GET /api/ambulance/:ambulanceId/status - Retrieve status and location of ambulance
router.get('/:ambulanceId/status', ambulanceAuth, asyncHandler(getAmbulanceStatus));

// PATCH /api/ambulance/:ambulanceId/location - Update live GPS location of ambulance
router.patch('/:ambulanceId/location', ambulanceAuth, asyncHandler(updateAmbulanceLocation));

// PATCH /api/ambulance/:ambulanceId/status - Update operational status for ambulance driver
router.patch('/:ambulanceId/status', ambulanceAuth, asyncHandler(updateAmbulanceStatus));

// POST /api/ambulance/:ambulanceId/acknowledge - Acknowledge assignment
router.post('/:ambulanceId/acknowledge', ambulanceAuth, asyncHandler(acknowledgeAssignment));

// POST /api/ambulance/:ambulanceId/arrive-patient - Report arrival at patient scene
router.post('/:ambulanceId/arrive-patient', ambulanceAuth, asyncHandler(reportPatientArrival));

// POST /api/ambulance/:ambulanceId/depart-patient - Report departure from patient scene
router.post('/:ambulanceId/depart-patient', ambulanceAuth, asyncHandler(reportPatientDeparture));

// POST /api/ambulance/:ambulanceId/arrive-hospital - Report arrival at hospital
router.post('/:ambulanceId/arrive-hospital', ambulanceAuth, asyncHandler(reportHospitalArrival));

// POST /api/ambulance/:ambulanceId/handoff-complete - Complete hospital handoff and become available
router.post('/:ambulanceId/handoff-complete', ambulanceAuth, asyncHandler(completeHandoff));

export default router;
