/**
 * 🔍 Deep Trace Test — يتتبع المسار الفعلي الذي يحدث داخل Render
 * يفحص كل خطوة بشكل منفصل:
 *   1. استخراج Video ID من الرابط
 *   2. جلب التفريغ النصي (Transcript)
 *   3. استدعاء Gemini API مباشرة
 *   4. إرسال النتيجة لتلغرام
 */

const BOT_TOKEN = '8993241037:AAELG6BL1p23AyfoHnz9CjuAnBlT28O7TmU';
const CHAT_ID = 5156693743;
const GEMINI_API_KEY = 'AQ.Ab8RN6KRaT_g1VYMs'; // first 20 chars from Render — أحتاج المفتاح كامل

const RENDER_URL = 'https://yt-summarizer-ai-backend.onrender.com';
const TEST_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // فيديو قصير للاختبار

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function log(icon, msg) { console.log(`${icon} ${msg}`); }

// ═══════════════════════════════════════════
// TEST A: استخراج Video ID
// ═══════════════════════════════════════════
function testVideoIdExtraction() {
  log('🔬', '═══ خطوة A: استخراج Video ID ═══');
  
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  ];

  for (const url of testUrls) {
    try {
      const parsed = new URL(url);
      let videoId = null;
      
      if (parsed.hostname === 'youtu.be') {
        videoId = parsed.pathname.substring(1).split('/')[0];
      } else if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v');
        if (!videoId) {
          const pathFormats = ['/embed/', '/v/', '/shorts/', '/live/'];
          for (const prefix of pathFormats) {
            if (parsed.pathname.startsWith(prefix)) {
              videoId = parsed.pathname.split('/')[2];
              break;
            }
          }
        }
      }
      log(videoId ? '✅' : '❌', `  ${url} → ${videoId || 'NOT FOUND'}`);
    } catch (err) {
      log('❌', `  ${url} → ERROR: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════
// TEST B: جلب التفريغ النصي من Render مباشرة
// ═══════════════════════════════════════════
async function testTranscriptFetch() {
  log('🔬', '═══ خطوة B: جلب التفريغ النصي (Transcript) عبر Render ═══');
  
  // نرسل طلب للـ health endpoint أولاً لنتأكد Render صاحي
  try {
    const healthRes = await fetchWithTimeout(`${RENDER_URL}/api/health`);
    const healthData = await healthRes.json();
    log('✅', `  Render حي: uptime=${(healthData.uptime/3600).toFixed(1)}h`);
  } catch (err) {
    log('❌', `  Render غير متاح: ${err.message}`);
    return null;
  }

  // نحاول نجلب التفريغ النصي عبر الـ API endpoint
  try {
    const res = await fetchWithTimeout(`${RENDER_URL}/api/process-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: TEST_VIDEO,
        language: 'ar',
        // لا نمرر apiKey — نريد نشوف هل Render يستخدم الافتراضي
      })
    }, 90000); // 90 ثانية timeout — المعالجة تأخذ وقت
    
    const data = await res.json();
    log('📋', `  HTTP Status: ${res.status}`);
    log('📋', `  Response Keys: ${Object.keys(data).join(', ')}`);
    
    if (data.summary) {
      log('✅', `  الملخص وصل! الطول: ${data.summary.length} حرف`);
      log('📋', `  أول 200 حرف: ${data.summary.substring(0, 200)}...`);
      return data;
    } else if (data.error) {
      log('❌', `  خطأ من Render: ${data.error}`);
      return null;
    } else {
      log('⚠️', `  رد غير متوقع: ${JSON.stringify(data).substring(0, 300)}`);
      return null;
    }
  } catch (err) {
    log('❌', `  فشل الطلب: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// TEST C: فحص Render logs عبر إرسال رابط يوتيوب حقيقي
// ═══════════════════════════════════════════
async function testRenderDirectWebhook() {
  log('🔬', '═══ خطوة C: إرسال رابط يوتيوب مباشرة لـ Render webhook ═══');
  
  // إرسال رسالة انتظار أولاً
  let loadingMsgId = null;
  try {
    const loadingRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: '🔬 <b>[Deep Trace Test]</b> جاري اختبار المعالجة الكاملة...',
        parse_mode: 'HTML'
      })
    });
    const loadingData = await loadingRes.json();
    loadingMsgId = loadingData.result?.message_id;
    log('📋', `  رسالة الانتظار: message_id = ${loadingMsgId}`);
  } catch (err) {
    log('⚠️', `  فشل إرسال رسالة الانتظار: ${err.message}`);
  }

  // إرسال الطلب مباشرة لـ Render
  try {
    const fakeUpdate = {
      update_id: Math.floor(Math.random() * 999999),
      message: {
        message_id: Math.floor(Math.random() * 99999),
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: CHAT_ID, first_name: 'DeepTraceTest', is_bot: false },
        text: TEST_VIDEO,
        date: Math.floor(Date.now() / 1000)
      },
      __loadingMsgId: loadingMsgId
    };

    const startTime = Date.now();
    const res = await fetchWithTimeout(`${RENDER_URL}/api/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'vercel-relay'
      },
      body: JSON.stringify(fakeUpdate)
    }, 10000);
    const elapsed = Date.now() - startTime;
    const data = await res.json();
    
    log('📋', `  Render Response (${elapsed}ms): ${JSON.stringify(data)}`);
    
    if (data.ok && data.queuedOnRender) {
      log('✅', `  الطلب دخل الطابور بنجاح`);
      
      // الآن ننتظر ونراقب هل تم تعديل الرسالة
      log('⏳', `  ننتظر 70 ثانية لمراقبة هل يتم تعديل الرسالة بالملخص...`);
      
      for (let i = 1; i <= 7; i++) {
        await new Promise(r => setTimeout(r, 10000));
        log('⏳', `  ${i*10} ثانية مرت...`);
        
        // نتحقق من محتوى الرسالة (عبر getUpdates — لكن هذا لا يعمل مع webhook)
        // بدلاً عن ذلك: نرسل رسالة فحص 
      }
      
      log('📋', `  ✋ انتهت فترة المراقبة. تحقق من تلغرام — هل تم تعديل رسالة ${loadingMsgId}؟`);
    } else {
      log('❌', `  الطلب لم يدخل الطابور: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    log('❌', `  فشل الطلب: ${err.message}`);
  }
}

// ═══════════════════════════════════════════
// TEST D: فحص Gemini API مباشرة (بدون Render)
// ═══════════════════════════════════════════
async function testGeminiApiDirect() {
  log('🔬', '═══ خطوة D: فحص Gemini API مباشرة ═══');
  
  // نحتاج المفتاح الكامل من Render
  try {
    const res = await fetchWithTimeout('https://api.render.com/v1/services/srv-d9ir5scm0tmc73a05k70/env-vars', {
      headers: {
        'Authorization': 'Bearer rnd_OPb1ew599xZyIQTB9O8JgMsOvrEf',
        'Accept': 'application/json'
      }
    });
    const envVars = await res.json();
    
    let geminiKey = null;
    for (const e of envVars) {
      const k = e.envVar?.key || e.key;
      const v = e.envVar?.value || e.value;
      if (k === 'GEMINI_API_KEY') geminiKey = v;
    }
    
    if (!geminiKey) {
      log('❌', `  GEMINI_API_KEY غير موجود في Render!`);
      return;
    }
    
    log('✅', `  GEMINI_API_KEY موجود (${geminiKey.substring(0, 15)}...)`);
    
    // نختبر Gemini مباشرة
    const testPrompt = 'Hello, respond with "Gemini API is working!" in one line.';
    const geminiRes = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }]
      })
    });
    
    // أضف الـ API key كـ query parameter
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const geminiRes2 = await fetchWithTimeout(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }]
      })
    });
    
    const geminiData = await geminiRes2.json();
    
    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      log('✅', `  Gemini API يعمل! الرد: ${geminiData.candidates[0].content.parts[0].text.trim()}`);
    } else if (geminiData.error) {
      log('❌', `  خطأ Gemini API: ${geminiData.error.message || JSON.stringify(geminiData.error)}`);
    } else {
      log('⚠️', `  رد غير متوقع: ${JSON.stringify(geminiData).substring(0, 300)}`);
    }
  } catch (err) {
    log('❌', `  فشل الاتصال: ${err.message}`);
  }
}

// ═══════════════════════════════════════════
// TEST E: فحص FIREBASE_SERVICE_ACCOUNT في Render
// ═══════════════════════════════════════════
async function testFirebaseConfig() {
  log('🔬', '═══ خطوة E: فحص متغيرات Firebase في Render ═══');
  
  try {
    const res = await fetchWithTimeout('https://api.render.com/v1/services/srv-d9ir5scm0tmc73a05k70/env-vars', {
      headers: {
        'Authorization': 'Bearer rnd_OPb1ew599xZyIQTB9O8JgMsOvrEf',
        'Accept': 'application/json'
      }
    });
    const envVars = await res.json();
    
    const envMap = {};
    for (const e of envVars) {
      const k = e.envVar?.key || e.key;
      const v = e.envVar?.value || e.value;
      if (k) envMap[k] = v;
    }
    
    // المتغيرات المطلوبة
    const required = [
      'TELEGRAM_BOT_TOKEN',
      'GEMINI_API_KEY',
      'FIREBASE_SERVICE_ACCOUNT',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_DATABASE_ID',
      'APP_URL',
      'FRONTEND_URL'
    ];
    
    for (const key of required) {
      const val = envMap[key];
      if (val) {
        log('✅', `  ${key} = ${val.substring(0, 25)}... (${val.length} chars)`);
      } else {
        log('❌', `  ${key} = ❌ غير موجود! هذا قد يسبب مشكلة!`);
      }
    }
    
    // فحص إضافي: هل FIREBASE_SERVICE_ACCOUNT هو JSON صالح؟
    if (envMap['FIREBASE_SERVICE_ACCOUNT']) {
      try {
        const parsed = JSON.parse(envMap['FIREBASE_SERVICE_ACCOUNT']);
        if (parsed.project_id) {
          log('✅', `  FIREBASE_SERVICE_ACCOUNT → JSON صالح ✓ (project: ${parsed.project_id})`);
        } else {
          log('⚠️', `  FIREBASE_SERVICE_ACCOUNT → JSON صالح لكن بدون project_id!`);
        }
      } catch (parseErr) {
        log('❌', `  FIREBASE_SERVICE_ACCOUNT → JSON غير صالح! ${parseErr.message}`);
      }
    }
    
    return envMap;
  } catch (err) {
    log('❌', `  فشل جلب متغيرات البيئة: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  🔍 Deep Trace Test — تتبع عميق لمسار البوت        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // A: Video ID extraction
  testVideoIdExtraction();
  console.log('');

  // E: Environment variables (أهم شيء!)
  const envMap = await testFirebaseConfig();
  console.log('');

  // D: Gemini API direct
  await testGeminiApiDirect();
  console.log('');

  // B: Process video via Render API
  await testTranscriptFetch();
  console.log('');

  // C: Direct webhook to Render (with monitoring)
  // await testRenderDirectWebhook(); // هذا يأخذ 70 ثانية — تفعيله اختياري
  
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  📊 انتهت الاختبارات — راجع النتائج أعلاه          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => console.error('💥 خطأ عام:', err));
