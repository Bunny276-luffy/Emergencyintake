import { aiService } from '../src/services/AIService';

describe('AIService Tests (Gemini API mocked)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // clears the cache
    process.env = { ...ORIGINAL_ENV };
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  describe('Configuration handling', () => {
    it('returns NOT_CONFIGURED when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.configured).toBe(false);
      expect(res.status).toBe('NOT_CONFIGURED');
    });

    it('attempts to call Gemini when GEMINI_API_KEY is present', async () => {
      process.env.GEMINI_API_KEY = 'test_key';
      
      // Mock a successful JSON response matching the Zod schema
      const mockApiResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                primaryCondition: 'Trauma',
                triageLevelSuggestion: 'IMMEDIATE_RED',
                summary: 'Severe trauma.',
                recommendedSpecialties: ['Trauma Surgery'],
                preArrivalPrepInstructions: ['O-negative blood']
              })
            }]
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.configured).toBe(true);
      expect(res.status).toBe('SUCCESS');
      expect(res.structuredReport?.primaryCondition).toBe('Trauma');
    });
  });

  describe('Failure and timeout behavior', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'test_key';
    });

    it('returns SERVICE_UNAVAILABLE on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.status).toBe('SERVICE_UNAVAILABLE');
      // Must NOT return fake data
      expect(res.structuredReport).toBeUndefined();
    });

    it('returns TIMEOUT on fetch timeout or abort', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';

      (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.status).toBe('TIMEOUT');
      expect(res.structuredReport).toBeUndefined();
    });

    it('returns INVALID_RESPONSE on malformed JSON', async () => {
      const mockApiResponse = {
        candidates: [{
          content: {
            parts: [{
              text: 'This is not JSON at all.'
            }]
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.status).toBe('INVALID_RESPONSE');
      expect(res.structuredReport).toBeUndefined();
    });

    it('returns INVALID_RESPONSE if AI output fails Zod validation', async () => {
      const mockApiResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                primaryCondition: 'Trauma',
                // Missing other required fields
              })
            }]
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      });

      const res = await aiService.structureVoiceClinicalReport('http://audio', 'some notes');
      expect(res.status).toBe('INVALID_RESPONSE');
      expect(res.message).toMatch(/structure invalid/);
      expect(res.structuredReport).toBeUndefined();
    });
  });
});
