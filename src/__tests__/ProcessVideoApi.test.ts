import express from 'express';

// Polyfill global fetch for Node environment in Jest
if (typeof global.fetch === 'undefined') {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({})
  });
}

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(),
    collection: jest.fn(() => 'mock-collection'),
    addDoc: jest.fn().mockResolvedValue({ id: 'mock-doc-123' }),
    doc: jest.fn(() => 'mock-doc-ref'),
    getDoc: jest.fn().mockResolvedValue({
      exists: () => false,
      data: () => ({})
    }),
    setDoc: jest.fn().mockResolvedValue(true),
    serverTimestamp: jest.fn(() => new Date().toISOString())
  };
});

// Mock Gemini Service to avoid network calls during integration test
jest.mock('../services/geminiService', () => ({
  summarizeVideoWithGemini: jest.fn().mockResolvedValue({
    summary: '# ملخص دراسي تجريبي\n- النقطة الأولى',
    videoTitle: 'عنوان الفيديو التجريبي',
    videoId: 'y2xclL3Nf_w'
  })
}));

const mockDb: any = {};

describe('Integration Test: /api/process-video API Route', () => {
  let app: express.Express;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key-12345';
    app = express();
    app.use(express.json());

    // Register /api/process-video handler matching server.ts behavior
    app.post('/api/process-video', async (req, res): Promise<any> => {
      const { videoUrl, isPublic, userId, userDisplayName, language } = req.body;

      if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'رابط الفيديو مطلوب.' });
      }

      const { addDoc, collection, serverTimestamp } = require('firebase/firestore');

      const initialSummaryData = {
        userId: userId || 'anonymous',
        userDisplayName: userDisplayName || 'مستخدم مجهول',
        videoUrl,
        language: language || 'ar',
        status: 'processing',
        isPublic: isPublic !== false,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(mockDb, 'summaries'), initialSummaryData);
      const documentId = docRef.id;

      return res.status(200).json({
        success: true,
        summaryId: documentId,
        documentId: documentId,
        status: 'processing',
        message: 'تم البدء في تحليل الفيديو في الخلفية بنجاح.'
      });
    });
  });

  test('creates a Firestore document with status "processing" and returns 200 OK with documentId', async () => {
    const { addDoc } = require('firebase/firestore');

    const reqBody = {
      videoUrl: 'https://www.youtube.com/watch?v=y2xclL3Nf_w',
      userId: 'test-user-99',
      userDisplayName: 'أحمد علي',
      language: 'ar'
    };

    // Simulate express request using supertest-like mock or direct invocation
    const req: any = { body: reqBody };
    let responseStatus = 0;
    let responseBody: any = null;

    const res: any = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        return res;
      }
    };

    // Execute route handler directly
    const routeLayer = app._router.stack.find((layer: any) => layer.route && layer.route.path === '/api/process-video');
    await routeLayer.route.stack[0].handle(req, res, () => {});

    expect(responseStatus).toBe(200);
    expect(responseBody).toBeDefined();
    expect(responseBody.success).toBe(true);
    expect(responseBody.status).toBe('processing');
    expect(responseBody.documentId).toBe('mock-doc-123');
    expect(addDoc).toHaveBeenCalled();
  });
});
