import { z } from 'zod';

export const reportPublicSOSSchema = z.object({
  emergencyType: z.string().min(1),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  description: z.string().min(1),
  reporterContact: z.string().optional(),
  patientInfo: z.any().optional(),
  // Architectural foundation for network retry
  idempotencyKey: z.string().optional(), 
});
