import { Request, Response } from 'express';
import { systemErrorService } from '../services/SystemErrorService';
import { auditService } from '../services/AuditService';
import { healthService } from '../services/HealthService';
import { incidentRepository } from '../repositories/IncidentRepository';
import { ambulanceRepository } from '../repositories/AmbulanceRepository';
import { hospitalRepository } from '../repositories/HospitalRepository';
import { HttpStatus } from '../utils/httpStatus';
import { ErrorSeverity, SystemErrorSource } from '../errors/ErrorSeverity';

export const getSystemErrors = async (req: Request, res: Response): Promise<void> => {
  const { severity, source, resolved } = req.query;

  const errors = await systemErrorService.getSystemErrors({
    severity: severity as ErrorSeverity,
    source: source as SystemErrorSource,
    resolved: resolved !== undefined ? resolved === 'true' : undefined,
  });

  res.status(HttpStatus.OK).json({
    success: true,
    data: errors,
    total: errors.length,
  });
};

export const resolveSystemError = async (req: Request, res: Response): Promise<void> => {
  const { errorId } = req.params;

  const success = await systemErrorService.resolveError(errorId);

  res.status(HttpStatus.OK).json({
    success,
    message: success ? `Error ${errorId} resolved` : `Error ${errorId} not found`,
  });
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const { who, source, action, result, incidentId } = req.query;

  const logs = await auditService.getAuditLogs({
    who: who as string,
    source: source as string,
    action: action as string,
    result: result as 'SUCCESS' | 'FAILURE' | 'PENDING',
    incidentId: incidentId as string,
  });

  res.status(HttpStatus.OK).json({
    success: true,
    data: logs,
    total: logs.length,
  });
};

export const getAdminSystemHealth = async (req: Request, res: Response): Promise<void> => {
  const health = await healthService.getSystemHealth();
  res.status(HttpStatus.OK).json({
    success: true,
    data: health,
  });
};

export const getSystemStats = async (req: Request, res: Response): Promise<void> => {
  const incidents = await incidentRepository.findAll();
  const ambulances = await ambulanceRepository.findAll();
  const hospitals = await hospitalRepository.findAll();
  const errors = await systemErrorService.getSystemErrors({ resolved: false });

  const activeIncidents = incidents.filter(
    (i) => !['HANDOFF_COMPLETED', 'CANCELLED'].includes(i.status)
  ).length;

  const availableAmbulances = ambulances.filter((a) => a.status === 'AVAILABLE').length;

  const totalEmergencyBeds = hospitals.reduce(
    (acc, h) => acc + h.capacity.availableEmergencyBeds,
    0
  );

  const totalICUBeds = hospitals.reduce((acc, h) => acc + h.capacity.availableICUBeds, 0);

  res.status(HttpStatus.OK).json({
    success: true,
    data: {
      totalIncidents: incidents.length,
      activeIncidents,
      totalAmbulances: ambulances.length,
      availableAmbulances,
      totalHospitals: hospitals.length,
      availableEmergencyBeds: totalEmergencyBeds,
      availableICUBeds: totalICUBeds,
      unresolvedSystemErrors: errors.length,
    },
  });
};

export const getFleetStatus = async (req: Request, res: Response): Promise<void> => {
  const ambulances = await ambulanceRepository.findAll();
  res.status(HttpStatus.OK).json({
    success: true,
    data: ambulances,
    total: ambulances.length,
  });
};

export const getHospitalsOverview = async (req: Request, res: Response): Promise<void> => {
  const hospitals = await hospitalRepository.findAll();
  res.status(HttpStatus.OK).json({
    success: true,
    data: hospitals,
    total: hospitals.length,
  });
};
