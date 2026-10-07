import { Request, Response } from 'express';
import { ambulanceService } from '../services/AmbulanceService';
import { HttpStatus } from '../utils/httpStatus';
import { AuthorizationService } from '../services/AuthorizationService';
import { AuthenticatedRequest } from '../middleware/authHandler';
import { updateLocationSchema, updateStatusSchema } from '../validation/ambulanceSchemas';

const verifyAccess = async (req: AuthenticatedRequest, ambulanceId: string, res: Response): Promise<boolean> => {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Authentication required' } });
    return false;
  }
  const hasAccess = await AuthorizationService.canAccessAmbulance(req.user, ambulanceId);
  if (!hasAccess) {
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { message: 'Unauthorized to access this ambulance resource' } });
    return false;
  }
  return true;
};

export const getAmbulanceAssignment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const result = await ambulanceService.getAssignment(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
};

export const getAmbulanceStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const ambulance = await ambulanceService.getAmbulanceById(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulance,
  });
};

export const updateAmbulanceLocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const parsed = updateLocationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { latitude, longitude } = parsed.data;
  const ambulance = await ambulanceService.updateLocation(ambulanceId, latitude, longitude);

  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulance,
    message: 'Ambulance GPS location updated successfully',
  });
};

export const updateAmbulanceStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { status } = parsed.data;
  const ambulance = await ambulanceService.updateStatus(ambulanceId, status);

  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulance,
    message: 'Ambulance status updated successfully',
  });
};

export const acknowledgeAssignment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const ambulance = await ambulanceService.acknowledgeAssignment(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulance,
    message: 'Assignment acknowledged successfully',
  });
};

export const reportPatientArrival = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const incident = await ambulanceService.reportPatientArrival(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: incident,
    message: 'Reported arrival at patient scene',
  });
};

export const reportPatientDeparture = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const incident = await ambulanceService.reportPatientDeparture(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: incident,
    message: 'Reported departure from patient scene towards hospital',
  });
};

export const reportHospitalArrival = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const incident = await ambulanceService.reportHospitalArrival(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: incident,
    message: 'Reported arrival at destination hospital',
  });
};

export const completeHandoff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { ambulanceId } = req.params;
  if (!(await verifyAccess(req, ambulanceId, res))) return;

  const result = await ambulanceService.completeHandoff(ambulanceId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
    message: 'Hospital handoff completed. Ambulance is now AVAILABLE for next emergency assignment.',
  });
};
