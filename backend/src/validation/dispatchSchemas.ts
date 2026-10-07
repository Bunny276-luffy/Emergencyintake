import { z } from 'zod';

export const assignAmbulanceSchema = z.object({
  incidentId: z.string().min(1),
  ambulanceId: z.string().min(1),
  hospitalId: z.string().optional(),
  notes: z.string().optional(),
});

export const createHospitalReservationSchema = z.object({
  incidentId: z.string().min(1),
  hospitalId: z.string().min(1),
  bedType: z.enum(['EMERGENCY', 'ICU']),
});

export const executeRerouteSchema = z.object({
  incidentId: z.string().min(1),
  ambulanceId: z.string().min(1),
  newHospitalId: z.string().min(1),
  reason: z.string().min(1),
});
