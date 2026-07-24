if (typeof global.Response === 'undefined') {
  (global as any).Response = class {};
}

// Polyfill global fetch for Node environment in Jest if missing
if (typeof global.fetch === 'undefined') {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({})
  });
}

// Mock firebase lib module before imports
jest.mock('../lib/firebase', () => ({
  db: {}
}));

import { 
  checkAndRecordTrialUsage, 
  getTrialStatus, 
  clearMemoryTrialCacheForTesting 
} from '../services/trialService';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => false,
    data: () => ({})
  }),
  setDoc: jest.fn().mockResolvedValue(true),
  serverTimestamp: jest.fn(() => new Date().toISOString())
}));

describe('Trial Usage System Unit & Integration Tests', () => {
  beforeEach(() => {
    clearMemoryTrialCacheForTesting();
  });

  test('allows first trial attempt for user without custom API key', async () => {
    const result = await checkAndRecordTrialUsage('user-trial-1');
    expect(result.allowed).toBe(true);
  });

  test('blocks second attempt within 10 minutes and triggers cooldown error', async () => {
    // First free trial
    const firstAttempt = await checkAndRecordTrialUsage('user-trial-2');
    expect(firstAttempt.allowed).toBe(true);

    // Immediate second trial
    const secondAttempt = await checkAndRecordTrialUsage('user-trial-2');
    expect(secondAttempt.allowed).toBe(false);
    expect(secondAttempt.remainingMinutes).toBeGreaterThan(0);
    expect(secondAttempt.error).toContain('يُسمح بالتلخيص');
  });

  test('reports status correctly via getTrialStatus', async () => {
    // Before any trial
    const initialStatus = await getTrialStatus('user-trial-3');
    expect(initialStatus.allowed).toBe(true);

    // Consume free trial
    await checkAndRecordTrialUsage('user-trial-3');

    // Check status during cooldown
    const statusInCooldown = await getTrialStatus('user-trial-3');
    expect(statusInCooldown.allowed).toBe(false);
    expect(statusInCooldown.remainingMinutes).toBe(10);
  });
});
