import { Request, Response } from 'express';
import { incidentService } from '../services/IncidentService';
import { HttpStatus } from '../utils/httpStatus';

import { reportPublicSOSSchema } from '../validation/publicSchemas';

export const reportPublicSOS = async (req: Request, res: Response): Promise<void> => {
  const parsed = reportPublicSOSSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, error: { message: 'Validation failed', details: parsed.error.issues } });
    return;
  }

  const { emergencyType, location, description, reporterContact, patientInfo, idempotencyKey } = parsed.data;

  const result = await incidentService.createPublicSOSIncident({
    emergencyType,
    location,
    description,
    reporterContact,
    patientInfo,
    idempotencyKey,
  });

  res.status(HttpStatus.CREATED).json({
    success: true,
    data: result,
  });
};

export const getIncidentStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const incident = await incidentService.getIncidentById(id);

  res.status(HttpStatus.OK).json({
    success: true,
    data: incident,
  });
};
