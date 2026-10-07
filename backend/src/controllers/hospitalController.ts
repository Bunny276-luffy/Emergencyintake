import { Request, Response } from 'express';
import { hospitalService } from '../services/HospitalService';
import { HttpStatus } from '../utils/httpStatus';
import { AuthorizationService } from '../services/AuthorizationService';
import { AuthenticatedRequest } from '../middleware/authHandler';
import { updateHospitalCapacitySchema, rejectReservationSchema, completeAdmissionSchema } from '../validation/hospitalSchemas';

const verifyAccess = async (req: AuthenticatedRequest, hospitalId: string, res: Response): Promise<boolean> => {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Authentication required' } });
    return false;
  }
  const hasAccess = await AuthorizationService.canAccessHospital(req.user, hospitalId);
  if (!hasAccess) {
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { message: 'Unauthorized to access this hospital resource' } });
    return false;
  }
  return true;
};

export const getHospitalProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const hospital = await hospitalService.getHospitalProfile(hospitalId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: hospital,
  });
};

export const updateHospitalCapacity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const parsed = updateHospitalCapacitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const capacityInfo = parsed.data;
  const hospital = await hospitalService.updateHospitalCapacity(hospitalId, capacityInfo);

  res.status(HttpStatus.OK).json({
    success: true,
    data: hospital,
    message: 'Hospital capacity updated successfully',
  });
};

export const getIncomingReservations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const reservations = await hospitalService.getIncomingReservations(hospitalId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: reservations,
    total: reservations.length,
  });
};

export const acceptReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId, reservationId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const reservation = await hospitalService.acceptReservation(hospitalId, reservationId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: reservation,
    message: `Bed reservation ${reservationId} ACCEPTED and confirmed by hospital ${hospitalId}`,
  });
};

export const rejectReservation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId, reservationId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const parsed = rejectReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { reason } = parsed.data;
  const reservation = await hospitalService.rejectReservation(hospitalId, reservationId, reason);

  res.status(HttpStatus.OK).json({
    success: true,
    data: reservation,
    message: `Bed reservation ${reservationId} REJECTED by hospital ${hospitalId}`,
  });
};

export const completeAdmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId } = req.params;
  if (!(await verifyAccess(req, hospitalId, res))) return;

  const parsed = completeAdmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { incidentId } = parsed.data;
  await hospitalService.completeAdmission(hospitalId, incidentId);

  res.status(HttpStatus.OK).json({
    success: true,
    message: `Hospital ${hospitalId} completed pre-arrival admission preparation for incident ${incidentId}`,
  });
};

export const generateHospitalPreArrivalSummaryAI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hospitalId, incidentId } = req.params;
  
  // Verify the hospital has access to THIS specific incident
  const hasIncidentAccess = await AuthorizationService.canAccessIncident(req.user!, incidentId);
  if (!hasIncidentAccess) {
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { message: 'Unauthorized to access this incident' } });
    return;
  }

  // Load paramedic service and ai service
  const { paramedicService } = require('../services/ParamedicService');
  const { aiService } = require('../services/AIService');

  const { report, patient } = await paramedicService.getAssignedIncident(incidentId);

  if (!report) {
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: 'No clinical report submitted for this incident yet',
    });
    return;
  }

  const result = await aiService.generatePreArrivalSummary(report, patient);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
};
