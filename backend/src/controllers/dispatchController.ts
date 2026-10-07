import { Request, Response } from 'express';
import { dispatchService } from '../services/DispatchService';
import { HttpStatus } from '../utils/httpStatus';

export const listActiveIncidents = async (req: Request, res: Response): Promise<void> => {
  const incidents = await dispatchService.listActiveIncidents();
  res.status(HttpStatus.OK).json({
    success: true,
    data: incidents,
    total: incidents.length,
  });
};

export const getIncidentDetails = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const details = await dispatchService.getIncidentDetails(id);
  res.status(HttpStatus.OK).json({
    success: true,
    data: details,
  });
};

export const listAvailableAmbulances = async (req: Request, res: Response): Promise<void> => {
  const ambulances = await dispatchService.listAvailableAmbulances();
  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulances,
    total: ambulances.length,
  });
};

export const findNearestAmbulances = async (req: Request, res: Response): Promise<void> => {
  const { latitude, longitude, radiusMeters } = req.query;

  const results = await dispatchService.findNearestAmbulances(
    parseFloat(latitude as string),
    parseFloat(longitude as string),
    radiusMeters ? parseInt(radiusMeters as string, 10) : undefined
  );

  res.status(HttpStatus.OK).json({
    success: true,
    data: results,
    total: results.length,
  });
};

import { assignAmbulanceSchema, createHospitalReservationSchema, executeRerouteSchema } from '../validation/dispatchSchemas';

export const assignAmbulance = async (req: Request, res: Response): Promise<void> => {
  const parsed = assignAmbulanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { incidentId, ambulanceId, hospitalId, notes } = parsed.data;

  await dispatchService.assignAmbulance({
    incidentId,
    ambulanceId,
    hospitalId,
    notes,
  });

  res.status(HttpStatus.OK).json({
    success: true,
    message: `Ambulance ${ambulanceId} assigned to incident ${incidentId} atomically`,
  });
};

export const findCandidateHospitals = async (req: Request, res: Response): Promise<void> => {
  const { latitude, longitude, requiredBedType, radiusMeters } = req.query;

  const candidates = await dispatchService.findCandidateHospitals(
    parseFloat(latitude as string),
    parseFloat(longitude as string),
    requiredBedType as 'EMERGENCY' | 'ICU',
    radiusMeters ? parseInt(radiusMeters as string, 10) : undefined
  );

  res.status(HttpStatus.OK).json({
    success: true,
    data: candidates,
    total: candidates.length,
  });
};

export const createHospitalReservation = async (req: Request, res: Response): Promise<void> => {
  const parsed = createHospitalReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { incidentId, hospitalId, bedType } = parsed.data;

  const reservation = await dispatchService.createHospitalReservation(incidentId, hospitalId, bedType);

  res.status(HttpStatus.CREATED).json({
    success: true,
    data: reservation,
  });
};

export const getReservationState = async (req: Request, res: Response): Promise<void> => {
  const { reservationId } = req.params;
  const reservation = await dispatchService.getReservationState(reservationId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: reservation,
  });
};

export const executeReroute = async (req: Request, res: Response): Promise<void> => {
  const parsed = executeRerouteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }
  const { incidentId, ambulanceId, newHospitalId, reason } = parsed.data;

  await dispatchService.executeReroute({
    incidentId,
    ambulanceId,
    newHospitalId,
    reason,
  });

  res.status(HttpStatus.OK).json({
    success: true,
    message: `Ambulance ${ambulanceId} rerouted to hospital ${newHospitalId} successfully`,
  });
};

export const getIncidentTimeline = async (req: Request, res: Response): Promise<void> => {
  const { incidentId } = req.params;
  const timeline = await dispatchService.getIncidentTimeline(incidentId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: timeline,
    total: timeline.length,
  });
};
