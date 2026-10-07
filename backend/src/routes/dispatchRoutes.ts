import { Router } from 'express';
import {
  listActiveIncidents,
  getIncidentDetails,
  listAvailableAmbulances,
  findNearestAmbulances,
  assignAmbulance,
  findCandidateHospitals,
  createHospitalReservation,
  getReservationState,
  executeReroute,
  getIncidentTimeline,
} from '../controllers/dispatchController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/authHandler';

const router = Router();
const dispatchAuth = [authenticate, requireRole(['DISPATCHER', 'ADMIN'])];

// GET /api/dispatch/incidents - List all active emergency incidents
router.get('/incidents', dispatchAuth, asyncHandler(listActiveIncidents));

// GET /api/dispatch/incident/:id - Retrieve detailed incident view
router.get('/incident/:id', dispatchAuth, asyncHandler(getIncidentDetails));

// GET /api/dispatch/ambulances/available - List all available ambulances
router.get('/ambulances/available', dispatchAuth, asyncHandler(listAvailableAmbulances));

// GET /api/dispatch/ambulances/nearest - PostGIS spatial search for nearest available ambulances
router.get('/ambulances/nearest', dispatchAuth, asyncHandler(findNearestAmbulances));

// POST /api/dispatch/assign - Assign ambulance to emergency atomically
router.post('/assign', dispatchAuth, asyncHandler(assignAmbulance));

// GET /api/dispatch/hospitals/candidate - PostGIS spatial search for suitable candidate hospitals
router.get('/hospitals/candidate', dispatchAuth, asyncHandler(findCandidateHospitals));

// POST /api/dispatch/reservation - Create hospital pre-arrival bed reservation
router.post('/reservation', dispatchAuth, asyncHandler(createHospitalReservation));

// GET /api/dispatch/reservation/:reservationId - Retrieve reservation status
router.get('/reservation/:reservationId', dispatchAuth, asyncHandler(getReservationState));

// POST /api/dispatch/reroute - Reroute ambulance to hospital with mandatory reason
router.post('/reroute', dispatchAuth, asyncHandler(executeReroute));

// GET /api/dispatch/incident/:incidentId/timeline - Retrieve audit log timeline for an incident
router.get('/incident/:incidentId/timeline', dispatchAuth, asyncHandler(getIncidentTimeline));

export default router;
