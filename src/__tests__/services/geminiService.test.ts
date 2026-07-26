/**
 * Unit Tests — Gemini Service Helpers (YouTube ID extraction & Validation)
 */
import { getYouTubeId } from '../../services/geminiService';

describe('Gemini Service Helpers', () => {
  test('getYouTubeId should extract ID from standard YouTube watch URLs', () => {
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&feature=shared')).toBe('dQw4w9WgXcQ');
  });

  test('getYouTubeId should extract ID from short YouTube URLs (youtu.be)', () => {
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });

  test('getYouTubeId should extract ID from YouTube Shorts and Embed URLs', () => {
    expect(getYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  test('getYouTubeId should return null for invalid URLs', () => {
    expect(getYouTubeId('https://google.com')).toBeNull();
    expect(getYouTubeId('not-a-url')).toBeNull();
    expect(getYouTubeId('')).toBeNull();
  });
});
