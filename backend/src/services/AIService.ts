import { ParamedicReport, Patient } from '../types';
import { logger } from '../utils/logger';
import { z } from 'zod';

export const structuredClinicalReportSchema = z.object({
  primaryCondition: z.string().describe('The primary medical condition observed.'),
  triageLevelSuggestion: z.enum(['IMMEDIATE_RED', 'URGENT_YELLOW', 'DELAYED_GREEN', 'EXPECTANT_BLACK'])
    .describe('Suggested triage level based on the clinical report. Paramedic has final authority.'),
  summary: z.string().describe('Concise summary of the clinical findings.'),
  recommendedSpecialties: z.array(z.string()).describe('List of recommended medical specialties for hospital handoff.'),
  preArrivalPrepInstructions: z.array(z.string()).describe('List of suggested instructions for hospital preparation.')
});

export type StructuredClinicalReport = z.infer<typeof structuredClinicalReportSchema>;

export interface StructuredClinicalReportAIResult {
  configured: boolean;
  status: 'SUCCESS' | 'NOT_CONFIGURED' | 'SERVICE_UNAVAILABLE' | 'ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';
  message: string;
  structuredReport?: StructuredClinicalReport;
}

export interface EmergencyClassificationAIResult {
  configured: boolean;
  status: 'SUCCESS' | 'NOT_CONFIGURED' | 'SERVICE_UNAVAILABLE' | 'ERROR' | 'TIMEOUT';
  message: string;
  suggestedPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedCategory?: string;
}

export class AIService {
  public getAIServiceStatus(): {
    status: 'HEALTHY' | 'NOT_CONFIGURED' | 'SERVICE_UNAVAILABLE';
    configured: boolean;
    provider: string;
    message: string;
  } {
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
    if (!hasApiKey) {
      return {
        status: 'NOT_CONFIGURED',
        configured: false,
        provider: 'GEMINI_AI',
        message: 'Gemini AI API key not configured in environment (GEMINI_API_KEY)',
      };
    }
    return {
      status: 'HEALTHY',
      configured: true,
      provider: 'GEMINI_AI',
      message: 'Gemini AI Clinical Intelligence gateway is operational',
    };
  }

  /**
   * Helper method to execute Gemini API fetch with 15s AbortController timeout
   * and single retry for temporary 503 / 429 status codes.
   */
  private async executeGeminiFetch(
    url: string,
    bodyPayload: object,
    timeoutMs = 15000
  ): Promise<Response> {
    const maxAttempts = 2;
    let lastResponse: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return response;
        }

        // Retry ONCE if HTTP 503 (High Demand) or 429 (Rate Limit)
        if ((response.status === 503 || response.status === 429) && attempt < maxAttempts) {
          const errorBody = await response.text();
          logger.warn(
            `[AI_SERVICE_RETRY] Gemini API returned temporary status ${response.status} (attempt ${attempt}/${maxAttempts}). Retrying in 1.5s... Body: ${errorBody}`
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }

        lastResponse = response;
        return response;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          logger.error(
            `[AI_SERVICE_TIMEOUT] Gemini API request timed out after ${timeoutMs / 1000}s (attempt ${attempt}/${maxAttempts})`
          );
          if (attempt < maxAttempts) {
            logger.warn(`[AI_SERVICE_RETRY] Retrying after timeout (attempt ${attempt}/${maxAttempts})...`);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          throw new Error('Gemini AI request timed out.');
        }

        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        throw err;
      }
    }

    if (lastResponse) {
      return lastResponse;
    }
    throw lastError || new Error('Gemini AI request failed');
  }

  /**
   * Processes voice report audio / notes and generates structured clinical report.
   */
  public async structureVoiceClinicalReport(
    audioUrl?: string,
    rawNotes?: string
  ): Promise<StructuredClinicalReportAIResult> {
    const status = this.getAIServiceStatus();
    if (!status.configured) {
      logger.info('[AI_SERVICE] Gemini API key not configured. Returning NOT_CONFIGURED state.');
      return {
        configured: false,
        status: 'NOT_CONFIGURED',
        message: 'AI voice clinical structuring service unavailable: GEMINI_API_KEY is not configured',
      };
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const prompt = `You are a clinical AI assistant helping a paramedic structure their field notes.
Provide assistive analysis strictly based on the provided notes.
Do NOT invent unavailable patient facts, vitals, or diagnoses.
Do NOT claim certainty beyond the provided information.
Return valid JSON adhering to this schema:
{
  "primaryCondition": "string (the primary medical condition observed)",
  "triageLevelSuggestion": "IMMEDIATE_RED | URGENT_YELLOW | DELAYED_GREEN | EXPECTANT_BLACK",
  "summary": "string (concise summary of findings)",
  "recommendedSpecialties": ["string (e.g., Trauma, Neurology)"],
  "preArrivalPrepInstructions": ["string (e.g., Prepare O-negative blood)"]
}
Remember: You are an assistant, not the final clinical authority. 

Voice URL: ${audioUrl || 'N/A'}
Notes: ${rawNotes || 'N/A'}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      };

      const response = await this.executeGeminiFetch(url, bodyPayload, 15000);

      if (!response.ok) {
        logger.error(`[AI_SERVICE_ERROR] Gemini API call failed. HTTP status: ${response.status}`);
        return {
          configured: true,
          status: 'SERVICE_UNAVAILABLE',
          message: 'AI service unavailable due to upstream API error',
        };
      }

      const data = await response.json();
      const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) {
        return {
          configured: true,
          status: 'INVALID_RESPONSE',
          message: 'AI returned empty payload',
        };
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(textOutput);
      } catch (parseError) {
        logger.error('[AI_SERVICE_ERROR] Failed to parse JSON from AI response');
        return {
          configured: true,
          status: 'INVALID_RESPONSE',
          message: 'AI returned malformed JSON',
        };
      }

      const validation = structuredClinicalReportSchema.safeParse(parsedJson);
      if (!validation.success) {
        logger.error('[AI_SERVICE_ERROR] AI response failed schema validation', validation.error.format());
        return {
          configured: true,
          status: 'INVALID_RESPONSE',
          message: 'AI response structure invalid',
        };
      }

      return {
        configured: true,
        status: 'SUCCESS',
        message: 'Voice clinical report structured successfully via Gemini AI',
        structuredReport: validation.data,
      };
    } catch (err: any) {
      if (err.message === 'Gemini AI request timed out.') {
        logger.error('[AI_SERVICE_TIMEOUT] Gemini AI request timed out');
        return {
          configured: true,
          status: 'TIMEOUT',
          message: 'AI service request timed out',
        };
      }
      
      logger.error(`[AI_SERVICE_ERROR] Failed to execute Gemini AI structuring: ${err.message}`);
      return {
        configured: true,
        status: 'ERROR',
        message: 'An unexpected error occurred while calling AI service',
      };
    }
  }

  /**
   * Generates ER team pre-arrival clinical summary based on paramedic report and patient data.
   */
  public async generatePreArrivalSummary(
    report: ParamedicReport,
    patient?: Patient
  ): Promise<{
    configured: boolean;
    status: string;
    summaryText?: string;
    message: string;
  }> {
    const status = this.getAIServiceStatus();
    if (!status.configured) {
      return {
        configured: false,
        status: 'NOT_CONFIGURED',
        message: 'AI pre-arrival summary service unavailable: GEMINI_API_KEY is not configured',
      };
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const prompt = `Synthesize a concise ER pre-arrival preparation briefing for the trauma/clinical team based strictly on the provided paramedic report.
Do not invent information. Act as a clinical assistant relaying structured facts.
Patient ID: ${patient?.id || 'Unknown'}
Age: ${patient?.age || 'N/A'}
Conditions: ${patient?.knownMedicalConditions?.join(', ') || 'None'}
Paramedic Summary: ${report.patientConditionSummary}
Triage: ${report.triageLevel}
Vitals: BP ${report.vitals.bloodPressureSystolic}/${report.vitals.bloodPressureDiastolic}, HR ${report.vitals.heartRate}, SpO2 ${report.vitals.oxygenSaturation}%`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const bodyPayload = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      const response = await this.executeGeminiFetch(url, bodyPayload, 15000);

      if (!response.ok) {
        logger.error(`[AI_SERVICE_ERROR] Gemini API call failed for pre-arrival summary. HTTP status: ${response.status}`);
        return {
          configured: true,
          status: 'SERVICE_UNAVAILABLE',
          message: 'AI service unavailable due to upstream API error',
        };
      }

      const data = await response.json();
      const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!summaryText) {
        return {
          configured: true,
          status: 'INVALID_RESPONSE',
          message: 'AI returned empty payload',
        };
      }
      
      return {
        configured: true,
        status: 'SUCCESS',
        summaryText,
        message: 'Pre-arrival summary generated successfully',
      };
    } catch (err: any) {
      if (err.message === 'Gemini AI request timed out.') {
        logger.error('[AI_SERVICE_TIMEOUT] Gemini AI request timed out');
        return {
          configured: true,
          status: 'TIMEOUT',
          message: 'AI service request timed out',
        };
      }
      
      logger.error(`[AI_SERVICE_ERROR] Failed to execute Gemini AI pre-arrival summary: ${err.message}`);
      return {
        configured: true,
        status: 'SERVICE_UNAVAILABLE',
        message: 'An unexpected error occurred while calling AI service',
      };
    }
  }
}

export const aiService = new AIService();
