import { z } from 'zod';

export const resolveSystemErrorSchema = z.object({
  // empty body is fine, or we could require notes if the system supports it
});

export const getSystemErrorsQuerySchema = z.object({
  severity: z.string().optional(),
  source: z.string().optional(),
  resolved: z.string().optional(),
});

export const getAuditLogsQuerySchema = z.object({
  who: z.string().optional(),
  source: z.string().optional(),
  action: z.string().optional(),
  result: z.enum(['SUCCESS', 'FAILURE', 'PENDING']).optional(),
  incidentId: z.string().optional(),
});
