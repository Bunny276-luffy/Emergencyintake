import { Router } from 'express';
import {
  getSystemErrors,
  resolveSystemError,
  getAuditLogs,
  getAdminSystemHealth,
  getSystemStats,
  getFleetStatus,
  getHospitalsOverview,
} from '../controllers/adminController';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, requireRole } from '../middleware/authHandler';

const router = Router();
const adminAuth = [authenticate, requireRole(['ADMIN'])];

// GET /api/admin/health - Global health overview for Admin Command Center
router.get('/health', adminAuth, asyncHandler(getAdminSystemHealth));

// GET /api/admin/errors - View all system errors across 6 applications & core services
router.get('/errors', adminAuth, asyncHandler(getSystemErrors));

// PATCH /api/admin/errors/:errorId/resolve - Mark a recorded system error as resolved
router.patch('/errors/:errorId/resolve', adminAuth, asyncHandler(resolveSystemError));

// GET /api/admin/audit - Audit trail of system actions
router.get('/audit', adminAuth, asyncHandler(getAuditLogs));

// GET /api/admin/stats - Operational statistics summary
router.get('/stats', adminAuth, asyncHandler(getSystemStats));

// GET /api/admin/ambulances - Live fleet status view
router.get('/ambulances', adminAuth, asyncHandler(getFleetStatus));

// GET /api/admin/hospitals - Live hospital network overview
router.get('/hospitals', adminAuth, asyncHandler(getHospitalsOverview));

export default router;
