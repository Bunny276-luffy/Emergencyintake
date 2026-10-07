import { z } from 'zod';

export const updateHospitalCapacitySchema = z.object({
  totalBeds: z.number().int().min(0).optional(),
  availableICUBeds: z.number().int().min(0).optional(),
  availableEmergencyBeds: z.number().int().min(0).optional(),
  availableVentilators: z.number().int().min(0).optional(),
  traumaCenterLevel: z.number().int().min(1).optional(),
  acceptingPatients: z.boolean().optional(),
});

export const rejectReservationSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

export const completeAdmissionSchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required'),
});
