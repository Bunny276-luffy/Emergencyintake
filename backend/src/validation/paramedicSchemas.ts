import { z } from 'zod';
import { TriageLevel } from '@prisma/client';

export const submitClinicalReportSchema = z.object({
  incidentId: z.string().min(1, 'incidentId is required'),
  patientConditionSummary: z.string().min(1, 'patientConditionSummary is required'),
  triageLevel: z.nativeEnum(TriageLevel),
  vitals: z.any().optional(),
  voiceReportAudioUrl: z.string().optional(),
});

export const updateClinicalReportSchema = z.object({
  patientConditionSummary: z.string().min(1).optional(),
  triageLevel: z.nativeEnum(TriageLevel).optional(),
  voiceReportAudioUrl: z.string().optional(),
  transcriptionText: z.string().optional(),
});
