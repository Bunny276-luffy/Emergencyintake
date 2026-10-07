import { Request, Response } from 'express';
import { paramedicService } from '../services/ParamedicService';
import { HttpStatus } from '../utils/httpStatus';
import { AuthorizationService } from '../services/AuthorizationService';
import { AuthenticatedRequest } from '../middleware/authHandler';
import { submitClinicalReportSchema, updateClinicalReportSchema } from '../validation/paramedicSchemas';

const verifyIncidentAccess = async (req: AuthenticatedRequest, incidentId: string, res: Response): Promise<boolean> => {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Authentication required' } });
    return false;
  }
  const hasAccess = await AuthorizationService.canAccessIncident(req.user, incidentId);
  if (!hasAccess) {
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { message: 'Unauthorized to access this incident' } });
    return false;
  }
  return true;
};

const verifyReportAccess = async (req: AuthenticatedRequest, reportId: string, res: Response): Promise<boolean> => {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({ success: false, error: { message: 'Authentication required' } });
    return false;
  }
  const hasAccess = await AuthorizationService.canAccessReport(req.user, reportId);
  if (!hasAccess) {
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { message: 'Unauthorized to access this clinical report' } });
    return false;
  }
  return true;
};

export const getAssignedIncident = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { incidentId } = req.params;
  if (!(await verifyIncidentAccess(req, incidentId, res))) return;

  const data = await paramedicService.getAssignedIncident(incidentId);

  res.status(HttpStatus.OK).json({
    success: true,
    data,
  });
};

export const submitClinicalReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = submitClinicalReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { incidentId, patientConditionSummary, triageLevel, vitals, voiceReportAudioUrl } = parsed.data;
  if (!(await verifyIncidentAccess(req, incidentId, res))) return;

  const report = await paramedicService.submitClinicalReport({
    incidentId,
    patientConditionSummary,
    triageLevel,
    vitals,
    voiceReportAudioUrl,
  });

  res.status(HttpStatus.CREATED).json({
    success: true,
    data: report,
  });
};

export const getClinicalReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { incidentId } = req.params;
  if (!(await verifyIncidentAccess(req, incidentId, res))) return;

  const report = await paramedicService.getClinicalReportByIncidentId(incidentId);

  res.status(HttpStatus.OK).json({
    success: true,
    data: report,
  });
};

export const updateClinicalReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { reportId } = req.params;
  if (!(await verifyReportAccess(req, reportId, res))) return;

  const parsed = updateClinicalReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { patientConditionSummary, triageLevel, voiceReportAudioUrl, transcriptionText } = parsed.data;

  const updated = await paramedicService.updateClinicalReport(reportId, {
    patientConditionSummary,
    triageLevel,
    voiceReportAudioUrl,
    transcriptionText,
  });

  res.status(HttpStatus.OK).json({
    success: true,
    data: updated,
    message: 'Clinical report updated successfully',
  });
};

export const structureVoiceReportAI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { audioUrl, rawNotes } = req.body;
  const { aiService } = require('../services/AIService');

  const result = await aiService.structureVoiceClinicalReport(audioUrl, rawNotes);

  res.status(HttpStatus.OK).json({
    success: true,
    data: result,
  });
};
