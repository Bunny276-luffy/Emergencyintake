import { Request, Response } from 'express';
import { healthService } from '../services/HealthService';
import { HttpStatus } from '../utils/httpStatus';

export const getHealth = async (req: Request, res: Response): Promise<void> => {
  const report = await healthService.getSystemHealth();
  res.status(HttpStatus.OK).json({
    success: true,
    data: report,
  });
};
