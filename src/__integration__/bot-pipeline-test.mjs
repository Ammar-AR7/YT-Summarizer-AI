/**
 * 🧪 Telegram Bot Full Pipeline Integration Test
 * يفحص كل مرحلة بشكل منفصل ويُظهر بالضبط أين ينكسر المسار
 * 
 * المراحل:
 *   1. Bot API Health — هل البوت حي ويستجيب؟
 *   2. Webhook Status — هل الـ Webhook مسجل وموجه لـ Vercel؟
 *   3. Send Direct Message — إرسال رسالة مباشرة من الباك إند للتلغرام
 *   4. Vercel Webhook POST — تمرير طلب يوتيوب لـ Vercel ومراقبة الاستجابة
 *   5. Render Health — هل خادم Render شغال؟
 *   6. Render Webhook POST — تمرير طلب مباشر لـ Render ومراقبة الاستجابة
 *   7. Full YouTube Relay — رسالة يوتيوب حقيقية → Vercel → Render → Telegram
 */

const BOT_TOKEN = '8993241037:AAELG6BL1p23AyfoHnz9CjuAnBlT28O7TmU';
const CHAT_ID = 5156693743;
const VERCEL_URL = 'https://yt-summarizer-ai-mocha.vercel.app';
const RENDER_URL = 'https://yt-summarizer-ai-backend.onrender.com';
const TEST_YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const results = [];
let testNum = 0;

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function pass(name, detail) {
  testNum++;
  results.push({ num: testNum, name, status: '✅ PASS', detail });
  log('✅', `[${testNum}] ${name}: ${detail}`);
}

function fail(name, detail) {
  testNum++;
  results.push({ num: testNum, name, status: '❌ FAIL', detail });
  log('❌', `[${testNum}] ${name}: ${detail}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
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

// ═══════════════════════════════════════════
// TEST 1: Bot API Health (getMe)
// ═══════════════════════════════════════════
async function test1_botHealth() {
  log('🔬', '─── اختبار 1: فحص حياة البوت (getMe) ───');
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      pass('Bot Health', `البوت حي ✓ | اسمه: @${data.result.username} | ID: ${data.result.id}`);
      return true;
    } else {
      fail('Bot Health', `الرد غير سليم: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    fail('Bot Health', `فشل الاتصال: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// TEST 2: Webhook Registration Status
// ═══════════════════════════════════════════
async function test2_webhookStatus() {
  log('🔬', '─── اختبار 2: فحص حالة الـ Webhook ───');
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json();
    if (data.ok && data.result) {
      const info = data.result;
      const hasUrl = info.url && info.url.length > 0;
      const pointsToVercel = info.url && info.url.includes('vercel');
      
      if (hasUrl && pointsToVercel) {
        pass('Webhook Status', `مسجل ✓ → ${info.url} | pending_updates: ${info.pending_update_count} | last_error: ${info.last_error_message || 'لا يوجد'}`);
      } else if (hasUrl) {
        fail('Webhook Status', `مسجل لكن ليس موجه لـ Vercel! → ${info.url}`);
      } else {
        fail('Webhook Status', `الـ Webhook غير مسجل! URL فارغ`);
      }
      
      // تحقق من وجود أخطاء سابقة
      if (info.last_error_message) {
        log('⚠️', `  آخر خطأ في الـ Webhook: "${info.last_error_message}" (التاريخ: ${new Date(info.last_error_date * 1000).toISOString()})`);
      }
      return info;
    }
    fail('Webhook Status', `رد غير سليم: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    fail('Webhook Status', `فشل الاتصال: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// TEST 3: Direct Message Send via Bot API
// ═══════════════════════════════════════════
async function test3_directMessage() {
  log('🔬', '─── اختبار 3: إرسال رسالة مباشرة للتلغرام ───');
  try {
    const text = `🧪 <b>اختبار اتصال مباشر</b>\n\nهذه رسالة من سكريبت الاختبار التلقائي.\nالتاريخ: ${new Date().toISOString()}`;
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (data.ok && data.result) {
      pass('Direct Message', `تم الإرسال بنجاح ✓ | message_id: ${data.result.message_id}`);
      return data.result.message_id;
    } else {
      fail('Direct Message', `فشل الإرسال: ${data.description || JSON.stringify(data)}`);
      return null;
    }
  } catch (err) {
    fail('Direct Message', `فشل الاتصال: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// TEST 4: Edit Message via Bot API
// ═══════════════════════════════════════════
async function test4_editMessage(messageId) {
  log('🔬', '─── اختبار 4: تعديل رسالة في التلغرام (editMessageText) ───');
  if (!messageId) {
    fail('Edit Message', 'لا يوجد message_id لتعديله (الاختبار 3 فشل)');
    return false;
  }
  try {
    const newText = `✅ <b>تم تعديل الرسالة بنجاح!</b>\n\nهذا يثبت أن Render يستطيع تعديل رسائل التلغرام مباشرة.\nالتاريخ: ${new Date().toISOString()}`;
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, message_id: messageId, text: newText, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (data.ok) {
      pass('Edit Message', `تم التعديل بنجاح ✓ | message_id: ${messageId}`);
      return true;
    } else {
      fail('Edit Message', `فشل التعديل: ${data.description || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    fail('Edit Message', `فشل الاتصال: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// TEST 5: Render Backend Health
// ═══════════════════════════════════════════
async function test5_renderHealth() {
  log('🔬', '─── اختبار 5: فحص حياة خادم Render ───');
  try {
    const res = await fetchWithTimeout(`${RENDER_URL}/api/health`, {}, 20000);
    const data = await res.json();
    if (data.status === 'ok') {
      const uptimeHrs = (data.uptime / 3600).toFixed(1);
      pass('Render Health', `Render شغال ✓ | uptime: ${uptimeHrs} ساعة`);
      return true;
    } else {
      fail('Render Health', `رد غير سليم: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    fail('Render Health', `فشل الاتصال (قد يكون نائماً): ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// TEST 6: Vercel Webhook GET (Status Check)
// ═══════════════════════════════════════════
async function test6_vercelWebhookGet() {
  log('🔬', '─── اختبار 6: فحص إعدادات Vercel Webhook (GET) ───');
  try {
    const res = await fetchWithTimeout(`${VERCEL_URL}/api/telegram-webhook`);
    const data = await res.json();
    
    log('📋', `  Vercel Response: ${JSON.stringify(data, null, 2)}`);
    
    if (data.success) {
      const tokenOk = data.botTokenConfigured;
      const renderOk = data.renderBackendUrlConfigured;
      const renderUrl = data.activeRenderUrlUsed;
      const webhookUrl = data.currentWebhookInfo?.url;
      
      if (tokenOk && webhookUrl) {
        pass('Vercel Webhook GET', `Bot Token: ${tokenOk ? '✓' : '✗'} | Render URL: ${renderUrl || 'غير محدد'} | Webhook: ${webhookUrl}`);
      } else {
        fail('Vercel Webhook GET', `Token: ${tokenOk} | Render configured: ${renderOk} | Webhook URL: ${webhookUrl || 'فارغ!'}`);
      }

      // فحص مهم: هل RENDER_BACKEND_URL مضبوط في Vercel؟
      if (!renderOk) {
        log('🚨', `  ⚠️ متغير RENDER_BACKEND_URL غير مضبوط في Vercel! يستخدم الافتراضي: ${renderUrl}`);
      }
      
      return data;
    }
    fail('Vercel Webhook GET', `رد غير سليم: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    fail('Vercel Webhook GET', `فشل الاتصال بـ Vercel: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// TEST 7: Vercel Webhook POST — أمر /start
// ═══════════════════════════════════════════
async function test7_vercelStartCommand() {
  log('🔬', '─── اختبار 7: إرسال أمر /start عبر Vercel Webhook ───');
  try {
    const fakeUpdate = {
      update_id: Math.floor(Math.random() * 999999),
      message: {
        message_id: Math.floor(Math.random() * 99999),
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: CHAT_ID, first_name: 'Test', is_bot: false },
        text: '/start',
        date: Math.floor(Date.now() / 1000)
      }
    };

    const res = await fetchWithTimeout(`${VERCEL_URL}/api/telegram-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeUpdate)
    });
    const data = await res.json();
    
    log('📋', `  Vercel /start Response: ${JSON.stringify(data)}`);
    
    if (data.ok && data.commandReply === '/start') {
      pass('Vercel /start', `تم الرد الفوري بنجاح ✓ → تحقق من تلغرام لرسالة الترحيب`);
      return true;
    } else {
      fail('Vercel /start', `رد غير متوقع: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    fail('Vercel /start', `فشل الاتصال: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// TEST 8: Vercel Webhook POST — رابط يوتيوب
// ═══════════════════════════════════════════
async function test8_vercelYoutubeRelay() {
  log('🔬', '─── اختبار 8: إرسال رابط يوتيوب عبر Vercel Webhook (Relay Test) ───');
  try {
    const fakeUpdate = {
      update_id: Math.floor(Math.random() * 999999),
      message: {
        message_id: Math.floor(Math.random() * 99999),
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: CHAT_ID, first_name: 'Test', is_bot: false },
        text: TEST_YOUTUBE_URL,
        date: Math.floor(Date.now() / 1000)
      }
    };

    const startTime = Date.now();
    const res = await fetchWithTimeout(`${VERCEL_URL}/api/telegram-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeUpdate)
    }, 30000);
    const elapsed = Date.now() - startTime;
    const data = await res.json();
    
    log('📋', `  Vercel YouTube Response (${elapsed}ms): ${JSON.stringify(data)}`);
    
    if (data.ok && data.vercelHandled) {
      const loadingMsgId = data.loadingMsgId;
      if (loadingMsgId) {
        pass('Vercel YouTube Relay', `رسالة الانتظار أُرسلت ✓ | loadingMsgId: ${loadingMsgId} | وقت الاستجابة: ${elapsed}ms → تحقق من تلغرام`);
      } else {
        fail('Vercel YouTube Relay', `الاستجابة ok لكن loadingMsgId فارغ = لم تُرسل رسالة الانتظار! (قد يكون BOT_TOKEN مفقوداً في Vercel)`);
      }
      return { data, elapsed, loadingMsgId };
    } else {
      fail('Vercel YouTube Relay', `رد غير متوقع: ${JSON.stringify(data)}`);
      return null;
    }
  } catch (err) {
    fail('Vercel YouTube Relay', `فشل الاتصال: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════
// TEST 9: Render Direct Webhook POST — رابط يوتيوب (بدون Vercel)
// ═══════════════════════════════════════════
async function test9_renderDirectProcess() {
  log('🔬', '─── اختبار 9: تمرير رابط يوتيوب مباشرة لـ Render (Direct Process) ───');
  
  // أولاً: إرسال رسالة انتظار يدوياً
  let loadingMsgId = null;
  try {
    const loadingRes = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: '⏳ <b>[اختبار مباشر لـ Render] جاري تحليل الفيديو...</b>',
        parse_mode: 'HTML'
      })
    });
    const loadingData = await loadingRes.json();
    loadingMsgId = loadingData.result?.message_id;
    log('📋', `  رسالة الانتظار: message_id = ${loadingMsgId}`);
  } catch (err) {
    log('⚠️', `  فشل إرسال رسالة الانتظار: ${err.message}`);
  }

  try {
    const fakeUpdate = {
      update_id: Math.floor(Math.random() * 999999),
      message: {
        message_id: Math.floor(Math.random() * 99999),
        chat: { id: CHAT_ID, type: 'private' },
        from: { id: CHAT_ID, first_name: 'Test', is_bot: false },
        text: TEST_YOUTUBE_URL,
        date: Math.floor(Date.now() / 1000)
      },
      __loadingMsgId: loadingMsgId
    };

    const startTime = Date.now();
    const res = await fetchWithTimeout(`${RENDER_URL}/api/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'vercel-relay' // محاكاة التمرير من Vercel
      },
      body: JSON.stringify(fakeUpdate)
    }, 10000);
    const elapsed = Date.now() - startTime;
    const data = await res.json();
    
    log('📋', `  Render Direct Response (${elapsed}ms): ${JSON.stringify(data)}`);
    
    if (data.ok && data.queuedOnRender) {
      pass('Render Direct Process', `الطلب دخل طابور المعالجة بنجاح ✓ | وقت الاستجابة: ${elapsed}ms → راقب رسالة التلغرام خلال 30-60 ثانية`);
      return true;
    } else {
      fail('Render Direct Process', `رد غير متوقع: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    fail('Render Direct Process', `فشل الاتصال بـ Render: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════
// MAIN: تشغيل كل الاختبارات بالتسلسل
// ═══════════════════════════════════════════
async function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  🧪 Telegram Bot Full Pipeline Integration Test     ║');
  console.log('║  Chat ID: ' + CHAT_ID + '                          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Stage 1: Bot API
  await test1_botHealth();
  console.log('');

  // Stage 2: Webhook
  await test2_webhookStatus();
  console.log('');

  // Stage 3: Direct Send
  const msgId = await test3_directMessage();
  console.log('');

  // Stage 4: Direct Edit
  await test4_editMessage(msgId);
  console.log('');

  // Stage 5: Render Health
  await test5_renderHealth();
  console.log('');

  // Stage 6: Vercel GET Status
  await test6_vercelWebhookGet();
  console.log('');

  // Stage 7: Vercel /start command
  await test7_vercelStartCommand();
  console.log('');

  // Stage 8: Vercel YouTube Relay
  await test8_vercelYoutubeRelay();
  console.log('');

  // Stage 9: Render Direct Process (الاختبار الأهم!)
  await test9_renderDirectProcess();
  console.log('');

  // ═══ Summary ═══
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  📊 ملخص نتائج الاختبارات                          ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  const passed = results.filter(r => r.status.includes('PASS')).length;
  const failed = results.filter(r => r.status.includes('FAIL')).length;
  for (const r of results) {
    console.log(`║ ${r.status} [${r.num}] ${r.name}`);
  }
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  ✅ نجح: ${passed}  |  ❌ فشل: ${failed}  |  المجموع: ${results.length}`);
  console.log('╚══════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n🔍 الاختبارات الفاشلة بالتفصيل:');
    for (const r of results.filter(r => r.status.includes('FAIL'))) {
      console.log(`  ❌ [${r.num}] ${r.name}: ${r.detail}`);
    }
  }
}

runAllTests().catch(err => {
  console.error('💥 خطأ عام في تشغيل الاختبارات:', err);
});
