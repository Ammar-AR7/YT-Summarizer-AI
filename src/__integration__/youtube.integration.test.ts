/**
 * Integration Test — YouTube Captions & Transcript Fetching (Real Network)
 */
import { getYouTubeId } from '../services/geminiService';

describe('YouTube Integration Tests (Real Network)', () => {
  // Use a well-known public video with captions
  const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  test('Should validate and extract video ID from real YouTube link', () => {
    const videoId = getYouTubeId(TEST_VIDEO_URL);
    expect(videoId).toBe('dQw4w9WgXcQ');
  });

  test('Should fetch page metadata from YouTube without crashing', async () => {
    const response = await fetch(TEST_VIDEO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html.length).toBeGreaterThan(1000);
  });
});
