import { GoogleGenAI } from '@google/genai';
import { YoutubeTranscript } from 'youtube-transcript';

// Exact ThinkingLevel enum as required by the guidelines
export enum ThinkingLevel {
  OFF = 'OFF',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

const SYSTEM_PROMPT = `الدور: أنت مُلخِّص ومُدوِّن ملاحظات أكاديمي خبير، ماهر في تحويل نصوص وفيديوهات يوتيوب إلى ملاحظات دراسية واضحة وموجزة ومنظمة للغاية. هدفك الأساسي هو المساعدة على الفهم السريع والمراجعة، بما يناسب الدراسة الشخصية والمشاركة مع الطلاب.

المهمة: لخّص محتوى الفيديو الذي سيتم تزويدك برابطه بناءً على التعليمات الصارمة التالية وكذلك يجب ان تسرد كل محتويات المقطع في التلخيص بدون ان تقوم باختصار أي جزء من المحتوى لنه يجب أن يكون الملخص شامل لكل ما في المقطع ولا يهم حجم الملخص ولكن يجب ان يكون كبير بما يناسب المقاطع الكبيرة والطويلة والمقاطع الغنية بالمعلوكات يجب ان يتم شرح كل ما فيها بدون اختصار  ولا تنسى ان تقوم بالتعليمات التالي .

تعليمات التلخيص والتنسيق لـ Notion:

1. الهيكل والتنسيق: نسّق المخرجات بالكامل باستخدام عناوين Markdown منظمة (مثل #، ##، ###) بحيث تكون مناسبة للاستيراد المباشر إلى Notion ككتل منفصلة. إذا وُجدت أي بيانات مقارنة أو معلومات يمكن جدولتها، فقم بتنسيقها كجدول Markdown.

فوراً لا تقم بتضمين أي طوابع زمنية (Timestamps) في مخرجاتك.

2. التكملة والشمولية: قدّم ملخصاً مفصلاً ومنظماً جيداً باستخدام بنية قائمة نقطية (Bullet Points). ضمّن جميع المعلومات الأساسية، والخطوات الضرورية، والنقاط الغاية في الأهمية، والاقتراحات المهمة. لا تحذف أو تتجاهل أي قسم من أقسام المحتوى.

3. اللغة والمصطلحات: استخدم مصطلحات عربية واضحة وبسيطة ومباشرة. وعند وجود مصطلحات تخصصية، قم بشرحها فوراً وبإيجاز. بالنسبة للاختصارات، ضع الصيغة الكاملة لأي اختصار بين قوسين مباشرة بعد أول ظهور له (مثال: Artificial Intelligence (AI)).

4. التسلسل والمنطق: رتّب المعلومات ترتيباً منطقياً يعكس تسلسل التدفق في الفيديو لضمان منع الالتباس. وإذا احتوى المحتوى على درس أو تعليمات خطوة بخطوة، فوضّح كل خطوة بترتيب تسلسلي رقمي واضح.

5. التعامل مع الأكواد (Code Blocks): إذا ذُكر أي شيفرة برمجية، فاعرضها داخل كتلة Markdown قابلة للنسخ مع تحديد لغة البرمجة. وإذا تم تقديم ناتج تنفيذ (Output) لهذه الشيفرة، فأدرجه كتعليق (Comment) داخل نفس كتلة الشيفرة ركز على انه إن وجد وإن لم يوجد شيء له علاقة بالبرمجة في الفيديو لا تضيف هذا المربع الخاص بالأكواد .

6. كتل الأمثلة والمفاهيم:
- إذا تمت مناقشة مفهوم دون شرح مسبق، فقدم شرحاً موجزاً له قبل المتابعة.
- إذا كان المحتوى يتطلب أمثلة عملية للتوضيح (برمجة، معادلات، إلخ)، فقم بابتكار وإدراج مثال عملي واضح وملائم، وضع وسماً واضحاً لهذا المثال باسم: (Gemini Example).

7. الأخطاء والتصحيحات: إذا اكتشفت أي معلومات خاطئة علمياً أو تقنياً، قم بتصحيحها فوراً وأبلغني صراحة بالخطأ والتصحيح باستخدام وسم: (Correction: Original Error Here).`;

export function getYouTubeId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    // Handle short URL: youtu.be/VIDEO_ID
    if (parsedUrl.hostname === 'youtu.be') {
      const path = parsedUrl.pathname.substring(1); // remove leading slash
      const segments = path.split('/');
      if (segments[0] && segments[0].length === 11) {
        return segments[0];
      }
    }

    // Handle standard URL: youtube.com/watch?v=VIDEO_ID or similar
    if (parsedUrl.hostname.includes('youtube.com')) {
      // 1. Check for 'v' query parameter (this is the standard video parameter)
      const vParam = parsedUrl.searchParams.get('v');
      if (vParam && vParam.length === 11) {
        return vParam;
      }

      // 2. Check for embeds: /embed/VIDEO_ID
      if (parsedUrl.pathname.startsWith('/embed/')) {
        const segments = parsedUrl.pathname.split('/');
        if (segments[2] && segments[2].length === 11) {
          return segments[2];
        }
      }

      // 3. Check for path-based formats: /v/, /shorts/, /live/
      const pathFormats = ['/v/', '/shorts/', '/live/'];
      for (const prefix of pathFormats) {
        if (parsedUrl.pathname.startsWith(prefix)) {
          const segments = parsedUrl.pathname.split('/');
          if (segments[2] && segments[2].length === 11) {
            return segments[2];
          }
        }
      }
    }
  } catch (e) {
    console.warn('URL parsing failed, falling back to regex', e);
  }

  // Safe, non-greedy fallback regex (includes live streams)
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : null;
}

// Extractor for player response JSON embedded in YouTube HTML watch page
export function extractPlayerResponse(html: string): any {
  const marker = 'ytInitialPlayerResponse = ';
  let index = html.indexOf(marker);
  if (index === -1) {
    const altMarker = 'var ytInitialPlayerResponse = ';
    index = html.indexOf(altMarker);
    if (index === -1) return null;
    index += altMarker.length - marker.length;
  }

  const startJson = index + marker.length;
  let braceCount = 0;
  let inString = false;
  let escape = false;
  let endJson = startJson;

  for (let i = startJson; i < html.length; i++) {
    const char = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          endJson = i + 1;
          break;
        }
      }
    }
  }

  if (endJson > startJson) {
    const jsonStr = html.substring(startJson, endJson);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse extracted playerResponse JSON:', e);
    }
  }
  return null;
}

// Custom parser to clean XML entities and extract text blocks
export function parseYoutubeCaptionsXml(xml: string): string {
  const texts: string[] = [];
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) {
      let txt = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (txt) {
        texts.push(txt);
      }
    }
  }
  return texts.join(' ');
}

async function fetchOEmbedMetadata(videoId: string): Promise<{ title: string; authorName: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || '',
        authorName: data.author_name || ''
      };
    }
  } catch (err) {
    console.warn('[YouTube Extraction] oEmbed fetch failed:', err);
  }
  return { title: '', authorName: '' };
}

export async function fetchYouTubeDataAndTranscript(videoId: string): Promise<{
  title: string;
  description: string;
  transcript: string;
}> {
  let title = '';
  let description = '';
  let transcript = '';

  // 1. Fetch clean metadata from the official reliable YouTube oEmbed API first
  const oembed = await fetchOEmbedMetadata(videoId);
  if (oembed.title) {
    title = oembed.title;
    console.log(`[YouTube Extraction] Retrieved official oEmbed title: "${title}"`);
  }

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[YouTube Extraction] Fetching page for Video: ${videoId}...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }
    const html = await response.text();

    // Check if the HTML is a consent page, captcha, or bot-blocked page
    const isConsentOrBlocked =
      html.includes('consent.youtube.com') ||
      html.includes('Before you continue to YouTube') ||
      html.includes('cookie') ||
      html.includes('unusual traffic') ||
      html.includes('captcha') ||
      html.includes('/recaptcha/');

    if (isConsentOrBlocked) {
      console.warn(`[YouTube Extraction] Warning: Detected YouTube bot block or consent page redirect. Ignoring scraped body.`);
    } else {
      const playerResponse = extractPlayerResponse(html);
      if (playerResponse) {
        // Only override title if it wasn't fetched via oEmbed
        if (!title) {
          title = playerResponse.videoDetails?.title || '';
        }
        description = playerResponse.videoDetails?.shortDescription || '';

        const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(captionTracks) && captionTracks.length > 0) {
          // Preference: 1. Arabic, 2. English, 3. Any available track
          let selectedTrack = captionTracks.find(t => t.languageCode === 'ar');
          if (!selectedTrack) {
            selectedTrack = captionTracks.find(t => t.languageCode === 'en');
          }
          if (!selectedTrack) {
            selectedTrack = captionTracks[0];
          }

          if (selectedTrack && selectedTrack.baseUrl) {
            let captionUrl = selectedTrack.baseUrl;
            // Auto-translate to Arabic if selected track is not Arabic and translation is supported
            if (selectedTrack.languageCode !== 'ar' && selectedTrack.isTranslatable !== false) {
              captionUrl += '&tlang=ar';
              console.log(`[YouTube Extraction] Auto-translating track (${selectedTrack.languageCode}) to Arabic via Google Translation...`);
            }

            try {
              const capResponse = await fetch(captionUrl);
              if (capResponse.ok) {
                const capXml = await capResponse.text();
                transcript = parseYoutubeCaptionsXml(capXml);
                console.log(`[YouTube Extraction] Successfully extracted and parsed captions from baseUrl.`);
              }
            } catch (capErr) {
              console.warn('[YouTube Extraction] Failed to fetch raw captions from baseUrl:', capErr);
            }
          }
        }
      }

      // Tag regex extract fallback for safety (only if not blocked and still missing title/description)
      const unescapeHtml = (str: string) => {
        return str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'");
      };

      if (!title) {
        const titlePatterns = [
          /<meta\s+property="og:title"\s+content="([^"]+)"/i,
          /<meta\s+name="title"\s+content="([^"]+)"/i,
          /<title>([^<]+)<\/title>/i
        ];
        for (const pattern of titlePatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            title = unescapeHtml(match[1].replace(' - YouTube', '').trim());
            break;
          }
        }
      }

      if (!description) {
        const descPatterns = [
          /<meta\s+property="og:description"\s+content="([^"]+)"/i,
          /<meta\s+name="description"\s+content="([^"]+)"/i
        ];
        for (const pattern of descPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            description = unescapeHtml(match[1].trim());
            break;
          }
        }
      }
    }

    // Ensure we have a descriptive fallback title if everything failed
    if (!title) {
      title = `تحليل الفيديو #${videoId}`;
    }

    return { title, description, transcript };

  } catch (error) {
    console.warn('[YouTube Extraction] General extraction error:', error);
    return { title: title || `تحليل الفيديو #${videoId}`, description: '', transcript: '' };
  }
}

// Keep backward compatible simple shell helpers if needed
export async function fetchYouTubeMetadata(videoId: string): Promise<{ title: string; description: string }> {
  const result = await fetchYouTubeDataAndTranscript(videoId);
  return { title: result.title, description: result.description };
}

export async function fetchTranscript(url: string): Promise<string> {
  // Try default fetch (usually auto-detect)
  try {
    const items = await YoutubeTranscript.fetchTranscript(url);
    if (items && items.length > 0) {
      return items.map((i) => i.text).join(' ');
    }
  } catch (error: any) {
    if (error?.name === 'YoutubeTranscriptDisabledError' || error?.message?.includes('Transcript is disabled')) {
      console.log(`[YouTube Captions] Transcript is disabled on video: ${url}`);
      return '';
    }
    console.warn(`[YouTube Captions] Default transcript fetch note for ${url}:`, error?.message || error);
  }

  // Try explicit Arabic language transcript fetch
  try {
    const items = await YoutubeTranscript.fetchTranscript(url, { lang: 'ar' });
    if (items && items.length > 0) {
      return items.map((i) => i.text).join(' ');
    }
  } catch (error: any) {
    // ignore secondary language attempt errors
  }

  // Try explicit English language transcript fetch
  try {
    const items = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
    if (items && items.length > 0) {
      return items.map((i) => i.text).join(' ');
    }
  } catch (error: any) {
    // ignore secondary language attempt errors
  }

  return '';
}

// State and daily quota tracking for default API key fallback
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

let inMemoryDefaultKeyMap = new Map<string, string>();

export function isDefaultKeyQuotaExhaustedToday(userId?: string): boolean {
  const today = getTodayDateString();
  const storageKey = userId ? `gemini_default_key_used_${userId}` : 'gemini_default_key_used_global';

  if (typeof window !== 'undefined' && window.localStorage) {
    const storedDate = localStorage.getItem(storageKey);
    return storedDate === today;
  }
  return inMemoryDefaultKeyMap.get(storageKey) === today;
}

export function recordDefaultKeyUsageToday(userId?: string): void {
  const today = getTodayDateString();
  const storageKey = userId ? `gemini_default_key_used_${userId}` : 'gemini_default_key_used_global';

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(storageKey, today);
  }
  inMemoryDefaultKeyMap.set(storageKey, today);
}

export function resetDefaultKeyUsageForTesting(): void {
  inMemoryDefaultKeyMap.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.clear();
  }
}

/**
 * Summarizes YouTube video using Gemini Pro/Flash models, with automatic 1-time fallback to default API key and daily quota management.
 */
export async function summarizeVideoWithGemini(
  videoUrl: string,
  apiKey: string,
  language: string = 'ar',
  userId?: string
): Promise<{ summary: string; videoTitle: string; videoId: string }> {
  const videoId = getYouTubeId(videoUrl);
  if (!videoId) {
    throw new Error('رابط يوتيوب غير صالح. يرجى التأكد من صحة الرابط.');
  }

  // Use combined extractor
  const extracted = await fetchYouTubeDataAndTranscript(videoId);
  let transcript = extracted.transcript;
  const videoTitle = extracted.title || `تحليل الفيديو #${videoId}`;
  const description = extracted.description;

  // Fallback to library if transcript is empty
  if (!transcript) {
    console.log('[YouTube Extraction] Combined fetch had no transcript. Trying fallback with library...');
    transcript = await fetchTranscript(videoUrl).catch(() => '');
  }

  // Track effective working API key
  let workingApiKey = apiKey;
  let hasSwitchedToDefaultKey = false;

  // Build the prompt containing the YouTube URL and transcript if available
  let promptContent = `Analyze the following YouTube video: ${videoUrl}\n`;
  promptContent += `Video ID: ${videoId}\n`;
  if (extracted.title) {
    promptContent += `Video Title: ${extracted.title}\n`;
  }
  if (extracted.description) {
    promptContent += `Video Description:\n${extracted.description}\n\n`;
  }

  // Language Instruction
  let langInstruction = 'Arabic (العربية الفصحى)';
  if (language === 'en') langInstruction = 'English';
  else if (language === 'fr') langInstruction = 'French (Français)';
  else if (language === 'es') langInstruction = 'Spanish (Español)';

  promptContent += `TARGET OUTPUT LANGUAGE: Please generate the summary and study notes strictly in ${langInstruction}.\n\n`;

  if (transcript) {
    promptContent += `Here is the transcript/captions content extracted from the video to help with the precise study notes translation:\n\n${transcript}`;
  } else {
    promptContent += `Important Note: The raw transcript/captions were not directly extracted for this video. Generate highly detailed, comprehensive, complete study notes in ${langInstruction} based on the metadata, title ("${extracted.title || ''}"), description, and actual video content. Ensure all key concepts, definitions, and logical steps are covered.`;
  }

  // Helper to execute generateContent with fallback to process.env.GEMINI_API_KEY if custom key fails
  async function callGeminiModel(modelName: string): Promise<string> {
    const currentKey = workingApiKey;
    try {
      const activeAi = new GoogleGenAI({ apiKey: currentKey });
      const response = await activeAi.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: promptContent }]
          }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT
        } as any
      });
      return response.text || '';
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isApiKeyOrQuotaError =
        errMsg.includes('invalid authentication credentials') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('UNAUTHENTICATED') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota') ||
        errMsg.includes('Quota') ||
        errMsg.includes('429') ||
        errMsg.includes('403') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('denied access') ||
        err.status === 401 ||
        err.status === 403 ||
        err.status === 429;

      if (isApiKeyOrQuotaError && !hasSwitchedToDefaultKey && process.env.GEMINI_API_KEY && currentKey !== process.env.GEMINI_API_KEY) {
        console.info(`[Quota Management] Primary API key failed on ${modelName}. Falling back to server default GEMINI_API_KEY...`);
        hasSwitchedToDefaultKey = true;
        workingApiKey = process.env.GEMINI_API_KEY;
        if (userId) {
          recordDefaultKeyUsageToday(userId);
        }

        const defaultAi = new GoogleGenAI({ apiKey: workingApiKey });
        const response = await defaultAi.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: promptContent }]
            }
          ],
          config: {
            systemInstruction: SYSTEM_PROMPT
          } as any
        });
        return response.text || '';
      }
      throw err;
    }
  }

  // Model candidate list in priority order (using valid, supported Gemini models)
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview'
  ];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    // Retry up to 3 times per model if encountering temporary high demand (503) or rate limits
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Gemini Request] Attempt ${attempt} on model ${modelName}...`);
        const summaryText = await callGeminiModel(modelName);
        if (summaryText && summaryText.trim().length > 0) {
          console.log(`[Gemini Request] Success with model ${modelName}`);
          return parseSummaryResponse(summaryText, videoTitle, videoId);
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);

        const isTransient = errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota') ||
          errMsg.includes('Quota');

        console.warn(`[Gemini Request] Attempt ${attempt} failed on ${modelName}:`, errMsg);

        if (isTransient && attempt < 3) {
          const waitTime = attempt * 1000;
          console.log(`[Gemini Request] Transient error or model limit. Retrying in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // Move to next candidate model if non-transient or exhausted retries for this model
          break;
        }
      }
    }
  }

  if (lastError) {
    throw new Error(cleanErrorMessage(lastError));
  }

  throw new Error('فشلت جميع محاولات توليد الملخص باستخدام نماذج الذكاء الاصطناعي المتوفرة حالياً.');
}

/**
 * Parses and cleans API errors to return polite, clear, non-technical Arabic messages.
 */
function cleanErrorMessage(error: any): string {
  const defaultMsg = 'حدث خطأ غير متوقع أثناء معالجة طلبك مع نموذج Gemini.';
  if (!error) return defaultMsg;

  let rawMessage = '';
  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error.message) {
    rawMessage = error.message;
  } else {
    try {
      rawMessage = JSON.stringify(error);
    } catch {
      rawMessage = String(error);
    }
  }

  if (rawMessage.includes('invalid authentication credentials') || rawMessage.includes('API key not valid') || rawMessage.includes('UNAUTHENTICATED') || rawMessage.includes('OAuth 2') || rawMessage.includes('401')) {
    return '🔑 خطأ في المصادقة: مفتاح Gemini API غير صالح أو غير مصرح له. يرجى التحقق من مفتاح API الخاص بك في إعدادات المنصة أو التواصل مع الدعم.';
  }

  if (rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE') || rawMessage.includes('high demand')) {
    return '⚡ تعاني خوادم الذكاء الاصطناعي من ضغط مؤقت مرتفع حالياً. يرجى المحاولة مرة أخرى بعد بضع ثوانٍ.';
  }

  // Check if it's a JSON string
  if (rawMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        const code = parsed.error.code;
        const msg = parsed.error.message || '';
        const status = parsed.error.status || '';

        if (code === 503 || status === 'UNAVAILABLE' || msg.includes('high demand')) {
          return '⚡ تعاني خوادم الذكاء الاصطناعي من ضغط مؤقت مرتفع حالياً. يرجى المحاولة مرة أخرى بعد بضع ثوانٍ.';
        }

        if (code === 429 || status === 'RESOURCE_EXHAUSTED' || msg.includes('quota') || msg.includes('Limit') || msg.includes('Quota')) {
          return '⚠️ تم تجاوز الحد المسموح به للطلبات (Quota Exceeded) في حساب Gemini المجاني حالياً.\n\nيرجى الانتظار لمدة دقيقة والمحاولة مرة أخرى، أو إعداد مفتاح API مخصص لتجنب قيود الفئة المجانية.';
        }
        return msg || defaultMsg;
      }
    } catch {
      // Use fallback matches below
    }
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('quota') || rawMessage.includes('429') || rawMessage.includes('Limit') || rawMessage.includes('Quota')) {
    return '⚠️ تم تجاوز الحد المسموح به للطلبات (Quota Exceeded) في حساب Gemini المجاني حالياً.\n\nيرجى الانتظار لمدة دقيقة والمحاولة مرة أخرى، أو إعداد مفتاح API مخصص لتجنب قيود الفئة المجانية.';
  }

  return rawMessage;
}

// Helper to extract the title and format the final response
function parseSummaryResponse(
  summaryText: string,
  defaultTitle: string,
  videoId: string
): { summary: string; videoTitle: string; videoId: string } {
  let refinedTitle = defaultTitle;
  const lines = summaryText.split('\n');
  const firstHeading = lines.find(l => l.startsWith('# '));
  if (firstHeading) {
    refinedTitle = firstHeading.replace('# ', '').trim();
  } else {
    const secondHeading = lines.find(l => l.startsWith('## '));
    if (secondHeading) {
      refinedTitle = secondHeading.replace('## ', '').trim();
    }
  }

  return {
    summary: summaryText,
    videoTitle: refinedTitle,
    videoId
  };
}
