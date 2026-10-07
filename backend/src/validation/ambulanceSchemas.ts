import { z } from 'zod';
import { AmbulanceStatus } from '@prisma/client';

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const updateStatusSchema = z.object({
  status: z.nativeEnum(AmbulanceStatus)
});
