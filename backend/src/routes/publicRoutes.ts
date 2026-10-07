import { Router } from 'express';
import { reportPublicSOS, getIncidentStatus } from '../controllers/publicController';
import { asyncHandler } from '../utils/asyncHandler';
import { publicSOSLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /api/public/sos - Submit emergency report from Public SOS app
router.post('/sos', publicSOSLimiter, asyncHandler(reportPublicSOS));

// GET /api/public/incident/:id - Retrieve public incident status by ID
router.get('/incident/:id', asyncHandler(getIncidentStatus));

export default router;
