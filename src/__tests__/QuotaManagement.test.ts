import { 
  isDefaultKeyQuotaExhaustedToday, 
  recordDefaultKeyUsageToday, 
  resetDefaultKeyUsageForTesting,
  summarizeVideoWithGemini,
  getTodayDateString
} from '../services/geminiService';

// Polyfill global fetch for Node environment in Jest if missing
if (typeof global.fetch === 'undefined') {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      title: 'عنوان تجريبي لاختبار الكوتا',
      author_name: 'قناة اختبارية'
    }),
    text: jest.fn().mockResolvedValue(`<html><title>عنوان تجريبي لاختبار الكوتا</title></html>`)
  });
}

// Mock @google/genai SDK
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(({ apiKey }) => {
      return {
        models: {
          generateContent: async (params: any) => {
            return mockGenerateContent(apiKey, params);
          }
        }
      };
    })
  };
});

describe('API Key Quota & Fallback Management Unit Tests', () => {
  beforeEach(() => {
    resetDefaultKeyUsageForTesting();
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = 'server-default-key-999';
  });

  test('tracks daily quota state correctly', () => {
    expect(isDefaultKeyQuotaExhaustedToday('test-user-1')).toBe(false);
    recordDefaultKeyUsageToday('test-user-1');
    expect(isDefaultKeyQuotaExhaustedToday('test-user-1')).toBe(true);
    resetDefaultKeyUsageForTesting();
    expect(isDefaultKeyQuotaExhaustedToday('test-user-1')).toBe(false);
  });

  test('grants 1-time fallback to default key when primary API key encounters a quota/auth error', async () => {
    // Primary key fails with quota error, server default key succeeds
    mockGenerateContent.mockImplementation((apiKey: string) => {
      if (apiKey === 'failing-primary-key') {
        throw new Error('RESOURCE_EXHAUSTED: Quota exceeded for model');
      }
      if (apiKey === 'server-default-key-999') {
        return { text: '# ملخص بنجاح مع المفتاح الافتراضي' };
      }
      throw new Error('Unexpected key');
    });

    const result = await summarizeVideoWithGemini(
      'https://www.youtube.com/watch?v=y2xclL3Nf_w',
      'failing-primary-key',
      'ar',
      'user-101'
    );

    expect(result.summary).toContain('ملخص بنجاح مع المفتاح الافتراضي');
    expect(isDefaultKeyQuotaExhaustedToday('user-101')).toBe(true);
  });

  test('blocks second fallback attempt on same day and informs user that quota is exhausted', async () => {
    // Force quota used today
    recordDefaultKeyUsageToday('user-102');

    mockGenerateContent.mockImplementation(() => {
      throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
    });

    await expect(
      summarizeVideoWithGemini(
        'https://www.youtube.com/watch?v=y2xclL3Nf_w',
        'another-failing-key',
        'ar',
        'user-102'
      )
    ).rejects.toThrow(/استنفاذ حصة/);
  });
});
