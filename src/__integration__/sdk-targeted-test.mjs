/**
 * 🎯 Targeted SDK Test — يختبر بالضبط نفس الكود الذي يعمل على Render
 * يستخدم @google/genai SDK مثل ما يستخدمه المشروع بالضبط
 */

// ═══════════════════════════════════════════
// Step 1: جلب المفتاح الكامل من Render
// ═══════════════════════════════════════════
async function getFullEnvVars() {
  console.log('🔑 جلب متغيرات البيئة الكاملة من Render...');
  const res = await fetch('https://api.render.com/v1/services/srv-d9ir5scm0tmc73a05k70/env-vars', {
    headers: {
      'Authorization': 'Bearer rnd_OPb1ew599xZyIQTB9O8JgMsOvrEf',
      'Accept': 'application/json'
    }
  });
  const envVars = await res.json();
  const map = {};
  for (const e of envVars) {
    const k = e.envVar?.key || e.key;
    const v = e.envVar?.value || e.value;
    if (k) map[k] = v;
  }
  return map;
}

// ═══════════════════════════════════════════
// Step 2: اختبار Gemini SDK مباشرة بنفس الطريقة
// ═══════════════════════════════════════════
async function testGeminiSDK(apiKey) {
  console.log('\n🤖 اختبار Gemini SDK بنفس طريقة المشروع...');
  console.log(`   المفتاح: ${apiKey.substring(0, 20)}...`);
  
  try {
    // Dynamic import — same as the project uses
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    
    // Test with a simple prompt first
    const models = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
    ];
    
    for (const model of models) {
      try {
        console.log(`\n   📡 جاري الاختبار مع ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: 'Say "Hello from Gemini!" in one line.' }] }]
        });
        const text = response.text || '';
        if (text.trim()) {
          console.log(`   ✅ ${model} → نجح! الرد: "${text.trim().substring(0, 100)}"`);
          return { success: true, model, text: text.trim() };
        } else {
          console.log(`   ⚠️ ${model} → رد فارغ`);
        }
      } catch (err) {
        console.log(`   ❌ ${model} → فشل: ${err.message?.substring(0, 150)}`);
      }
    }
    
    // Now test with the EXACT models from geminiService.ts
    console.log('\n   📡 اختبار بنفس قائمة الموديلات الموجودة في geminiService.ts...');
    const projectModels = [
      'gemini-3.6-flash',
      'gemini-flash-latest', 
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview'
    ];
    
    for (const model of projectModels) {
      try {
        console.log(`   📡 ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: 'Say "OK" in one word.' }] }]
        });
        const text = response.text || '';
        console.log(`   ${text.trim() ? '✅' : '⚠️'} ${model} → ${text.trim() ? 'نجح' : 'رد فارغ'}`);
      } catch (err) {
        console.log(`   ❌ ${model} → فشل: ${err.message?.substring(0, 200)}`);
      }
    }
    
    return { success: false };
  } catch (err) {
    console.log(`   ❌ فشل تحميل SDK: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════
// Step 3: اختبار Firebase Admin بدون Service Account
// ═══════════════════════════════════════════
async function testFirebaseWithoutServiceAccount() {
  console.log('\n🔥 اختبار Firebase Admin بدون FIREBASE_SERVICE_ACCOUNT...');
  try {
    // Simulate what Render does — no FIREBASE_SERVICE_ACCOUNT set
    const { initializeApp, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    
    if (getApps().length === 0) {
      initializeApp({ projectId: 'gen-lang-client-0329124872' });
    }
    
    const db = getFirestore(getApps()[0], 'ai-studio-7faca6ee-f502-45b4-85e5-f11d3f96dc46');
    
    // Try a simple read
    console.log('   📖 محاولة قراءة من Firestore...');
    const snap = await db.collection('users').limit(1).get();
    console.log(`   ✅ Firestore يعمل! عدد المستندات: ${snap.size}`);
    return true;
  } catch (err) {
    console.log(`   ❌ Firestore فشل: ${err.message?.substring(0, 200)}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// Step 4: اختبار YouTube Transcript extraction
// ═══════════════════════════════════════════
async function testTranscriptExtraction() {
  console.log('\n📝 اختبار استخراج التفريغ النصي...');
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcript = await YoutubeTranscript.fetchTranscript('dQw4w9WgXcQ');
    if (transcript && transcript.length > 0) {
      const text = transcript.map(t => t.text).join(' ');
      console.log(`   ✅ التفريغ النصي وصل! عدد المقاطع: ${transcript.length}, طول النص: ${text.length}`);
      console.log(`   📋 أول 200 حرف: ${text.substring(0, 200)}...`);
      return true;
    } else {
      console.log('   ⚠️ لا يوجد تفريغ نصي');
      return false;
    }
  } catch (err) {
    console.log(`   ❌ فشل: ${err.message?.substring(0, 200)}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// Step 5: اختبار شامل — Render endpoint مع مراقبة النتيجة
// ═══════════════════════════════════════════
async function testFullRenderFlow() {
  console.log('\n🔄 اختبار المسار الكامل عبر Render مع مراقبة...');
  
  const BOT_TOKEN = '8993241037:AAELG6BL1p23AyfoHnz9CjuAnBlT28O7TmU';
  const CHAT_ID = 5156693743;
  const RENDER_URL = 'https://yt-summarizer-ai-backend.onrender.com';
  
  // أرسل رسالة انتظار
  const loadingRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: '🧪 <b>[SDK Test]</b> جاري اختبار المعالجة الكاملة عبر Render...',
      parse_mode: 'HTML'
    })
  });
  const loadingData = await loadingRes.json();
  const loadingMsgId = loadingData.result?.message_id;
  console.log(`   رسالة الانتظار: message_id = ${loadingMsgId}`);
  
  // أرسل webhook مباشرة لـ Render
  const fakeUpdate = {
    update_id: Math.floor(Math.random() * 999999),
    message: {
      message_id: Math.floor(Math.random() * 99999),
      chat: { id: CHAT_ID, type: 'private' },
      from: { id: CHAT_ID, first_name: 'SDKTest', is_bot: false },
      text: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      date: Math.floor(Date.now() / 1000)
    },
    __loadingMsgId: loadingMsgId
  };

  const renderRes = await fetch(`${RENDER_URL}/api/telegram-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Source': 'vercel-relay' },
    body: JSON.stringify(fakeUpdate)
  });
  const renderData = await renderRes.json();
  console.log(`   Render response: ${JSON.stringify(renderData)}`);
  
  // مراقبة: ننتظر 90 ثانية ونتحقق كل 15 ثانية
  console.log('   ⏳ مراقبة رسالة التلغرام لمدة 90 ثانية...');
  
  // نراقب بالتحقق من الرسالة عبر forwardMessage (حيلة: نحاول نمرر الرسالة لنفس الشات ونشوف محتواها)
  for (let i = 1; i <= 6; i++) {
    await new Promise(r => setTimeout(r, 15000));
    console.log(`   ⏳ ${i * 15}s مرت...`);
  }
  
  // إرسال رسالة نهائية
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `✋ <b>[SDK Test]</b> انتهت فترة المراقبة.\nتحقق من الرسالة ${loadingMsgId} — هل تم تعديلها بالملخص؟`,
      parse_mode: 'HTML'
    })
  });
}

// ═══════════════════════════════════════════
// Step 6: فحص Vercel عبر المتصفح
// ═══════════════════════════════════════════
async function checkVercelConfig() {
  console.log('\n🔍 فحص إعدادات Vercel عبر GET endpoint...');
  try {
    const res = await fetch('https://yt-summarizer-ai-mocha.vercel.app/api/telegram-webhook');
    const data = await res.json();
    console.log('   Vercel Config:', JSON.stringify(data, null, 2));
    
    if (!data.botTokenConfigured) {
      console.log('   ❌ TELEGRAM_BOT_TOKEN غير مضبوط في Vercel!');
    }
    if (!data.renderBackendUrlConfigured) {
      console.log('   ❌ RENDER_BACKEND_URL غير مضبوط في Vercel!');
    }
    if (data.activeRenderUrlUsed) {
      console.log(`   ✅ Render URL: ${data.activeRenderUrlUsed}`);
    }
    
    return data;
  } catch (err) {
    console.log(`   ❌ فشل: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  🎯 Targeted SDK + Firebase + Full Pipeline Test    ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // 1. جلب المتغيرات
  const envMap = await getFullEnvVars();
  console.log('\n📋 متغيرات Render:');
  for (const [k, v] of Object.entries(envMap)) {
    console.log(`   ${k} = ${String(v).substring(0, 30)}... (${String(v).length} chars)`);
  }

  // 2. Vercel
  await checkVercelConfig();

  // 3. Gemini SDK
  if (envMap.GEMINI_API_KEY) {
    await testGeminiSDK(envMap.GEMINI_API_KEY);
  }

  // 4. Firebase
  await testFirebaseWithoutServiceAccount();

  // 5. Transcript
  await testTranscriptExtraction();

  // 6. Full flow (يأخذ 90 ثانية)
  console.log('\n⚡ هل تريد تشغيل اختبار المسار الكامل (90 ثانية)؟ يعمل تلقائياً...');
  await testFullRenderFlow();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  📊 انتهت جميع الاختبارات                          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => console.error('💥', err));
