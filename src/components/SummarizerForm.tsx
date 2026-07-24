import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserConfig, OutputFormat } from '../types';
import { Youtube, Send, Share2, HelpCircle, Globe } from 'lucide-react';

interface SummarizerFormProps {
  user: User | null;
  userConfig: UserConfig | null;
  onSummaryGenerated: (result: {
    summary: string;
    videoTitle: string;
    videoId: string;
    summaryId: string;
    format: OutputFormat;
  }) => void;
}

const LOADING_STEPS = [
  'جاري جلب تفاصيل الفيديو النصية من يوتيوب... 🌐',
  'جاري استدعاء نموذج ذكاء اصطناعي فائق Gemini... 🧠',
  'تنشيط وضع التفكير عالي الكثافة لتوليد الأفكار وهيكلتها... ⚡',
  'جاري صياغة الملاحظات الأكاديمية وتنسيق كتل Notion... 📝',
  'جاري تنظيم الشيفرات البرمجية وتصحيح المصطلحات وحفظ الملخص... ✨'
];

export default function SummarizerForm({ user, userConfig, onSummaryGenerated }: SummarizerFormProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('display');
  const [language, setLanguage] = useState<'ar' | 'en' | 'fr' | 'es'>('ar');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 4000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      setError('يرجى إدخال رابط فيديو يوتيوب أولاً.');
      return;
    }

    // Check if YouTube URL is valid
    const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    if (!isYoutube) {
      setError('رابط الفيديو غير صالح. يجب أن يكون رابط فيديو يوتيوب صحيحاً.');
      return;
    }

    // Trial Logic: Check if user provided custom API Key (either in userConfig or localStorage)
    const effectiveGeminiKey = (userConfig?.geminiApiKey || localStorage.getItem('user_gemini_api_key') || '').trim();
    const hasCustomKey = effectiveGeminiKey.length > 0;

    if (!hasCustomKey) {
      try {
        const usageRaw = localStorage.getItem('yt_summarizer_free_usage');
        if (usageRaw) {
          const usage = JSON.parse(usageRaw);
          const now = Date.now();
          const cooldownMs = 10 * 60 * 1000; // 10 minutes
          if (usage.count >= 1 && (now - usage.timestamp) < cooldownMs) {
            const remainingMins = Math.ceil((cooldownMs - (now - usage.timestamp)) / 60000);
            setError(`⚠️ يُسمح بالتلخيص باستخدام المفتاح الافتراضي مرة واحدة كل 10 دقائق. يرجى الانتظار لمدة ${remainingMins} دقيقة للطلب التالي، أو إضافة مفتاح Gemini API الخاص بك في قسم الإعدادات لاستخدام التلخيص المباشر بدون أي قيود أو انتظار.`);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse local trial usage:', e);
      }
    }

    // Default to display format directly on site
    setLoading(true);
    setError(null);

    try {
      // Call our express backend API route /api/process-video
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          language,
          isPublic,
          userId: user?.uid || 'anonymous',
          userDisplayName: user?.displayName || (user?.isAnonymous ? 'مستكشف تجريبي' : 'مستخدم مجهول'),
          geminiApiKey: effectiveGeminiKey
        })
      });

      let data: any = {};
      try {
        const resText = await response.text();
        data = JSON.parse(resText);
      } catch (e) {
        console.error('Failed to parse API response as JSON:', e);
        throw new Error('حدث خطأ في استجابة الخادم. يرجى التأكد من إضافة GEMINI_API_KEY في إعدادات البيئة بالخادم.');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'فشل البدء في تلخيص الفيديو. يرجى المحاولة لاحقاً.');
      }

      // Record free usage if no custom key
      if (!hasCustomKey) {
        try {
          localStorage.setItem('yt_summarizer_free_usage', JSON.stringify({
            count: 1,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Failed to update free usage in localStorage:', e);
        }
      }

      const summaryId = data.summaryId || data.documentId;

      // Asynchronous Polling loop to get complete summary status
      let attempts = 0;
      const maxAttempts = 60; // 60 * 2s = 120 seconds max wait time
      let finalSummaryData: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        const statusRes = await fetch(`/api/summary/${summaryId}`);
        if (statusRes.ok) {
          let statusData: any = null;
          try {
            const statusText = await statusRes.text();
            statusData = JSON.parse(statusText);
          } catch (parseErr) {
            console.warn('Status response was not valid JSON:', parseErr);
            continue;
          }

          if (statusData && statusData.success) {
            if (statusData.status === 'completed') {
              finalSummaryData = statusData;
              break;
            } else if (statusData.status === 'error' || statusData.error) {
              const rawErr = statusData.error || 'حدث خطأ أثناء معالجة الفيديو بالذكاء الاصطناعي.';
              const cleanErr = rawErr.replace(/^QUOTA_EXHAUSTED_DAILY_LIMIT:\s*/, '');
              throw new Error(cleanErr);
            }
          }
        }
      }

      if (!finalSummaryData || !finalSummaryData.summary) {
        throw new Error('استغرقت معالجة الفيديو وقتاً أطول من المتوقع. يمكنك الاطلاع على الملخص لاحقاً في التغذية العامة.');
      }

      // Success callback (displays summary directly on site)
      onSummaryGenerated({
        summary: finalSummaryData.summary,
        videoTitle: finalSummaryData.videoTitle,
        videoId: finalSummaryData.videoId,
        summaryId,
        format: 'display'
      });

      // Clear input
      setVideoUrl('');

    } catch (err: any) {
      console.error('Error generating summary:', err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء معالجة الفيديو.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-right" dir="rtl" id="summarizer-box">
      <h2 className="font-sans font-bold text-gray-900 text-lg mb-2 flex items-center gap-2">
        <Youtube className="w-6 h-6 text-indigo-600" />
        <span>ابدأ تلخيص فيديو جديد</span>
      </h2>
      <p className="text-xs text-gray-500 mb-6 leading-relaxed font-sans">
        أدخل رابط محاضرة أو درس من يوتيوب، واختر لغة المخرجات، وسيتم توليد وعرض التقرير الدراسي مباشرة على الصفحة حيث يمكنك تصديره بأي صيغة لاحقاً.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 font-sans">
        
        {/* YouTube URL input */}
        <div className="relative">
          <input
            type="text"
            placeholder="أدخل رابط فيديو يوتيوب هنا (e.g. https://www.youtube.com/watch?v=...)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={loading}
            className="w-full text-xs sm:text-sm pl-4 pr-11 py-3 border border-gray-200 rounded-2xl focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-300 text-left"
            dir="ltr"
            id="youtube-url-input"
          />
          <div className="absolute right-3 top-3.5 text-gray-400">
            <Youtube className="w-5 h-5 text-indigo-600" />
          </div>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2.5 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>لغة التلخيص والملاحظات الدراسية:</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'ar', label: 'العربية', flag: '🇸🇦', desc: 'توليد الملاحظات والملخص بالحروف العربية' },
              { id: 'en', label: 'English', flag: '🇺🇸', desc: 'Summaries & academic notes in English' }
            ].map((lang) => (
              <button
                type="button"
                key={lang.id}
                disabled={loading}
                onClick={() => setLanguage(lang.id as any)}
                className={`relative group p-3.5 rounded-2xl text-right transition-all duration-300 border cursor-pointer overflow-hidden transform hover:-translate-y-0.5 ${
                  language === lang.id
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/40 text-indigo-950 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'border-gray-200/90 bg-white hover:border-indigo-300 hover:bg-slate-50/80 text-gray-700 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{lang.flag}</span>
                    <span className={`text-sm font-bold ${language === lang.id ? 'text-indigo-900' : 'text-gray-800'}`}>
                      {lang.label}
                    </span>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    language === lang.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'
                  }`}>
                    {language === lang.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug font-sans">
                  {lang.desc}
                </p>
              </button>
            ))}
          </div>
        </div>



        {/* Share Checkbox */}
        <div className="flex items-center justify-between py-2 border-y border-gray-50">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600">مشاركة الملخص في التغذية العامة للمجتمع</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isPublic} 
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={loading}
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-amber-50 text-amber-900 text-xs rounded-2xl border border-amber-200 flex flex-col gap-2.5 animate-fade-in text-right" dir="rtl">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950 text-xs leading-relaxed">{error}</p>
                {(error.includes('حصة') || error.includes('Gemini') || error.includes('مفتاح')) && (
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    💡 يمكنك إضافة مفتاح Gemini API المجاني الخاص بك من قسم الإعدادات (على يسار الصفحة) لمتابعة التلخيص فوراً دون الحاجة للانتظار!
                  </p>
                )}
              </div>
            </div>

            {(error.includes('حصة') || error.includes('Gemini') || error.includes('مفتاح')) && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('settings-panel');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                    const editBtn = document.getElementById('edit-settings-btn');
                    if (editBtn) editBtn.click();
                  }
                }}
                className="self-start mt-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>فتح إعدادات مفتاح Gemini API 🔑</span>
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-6 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-gray-900">جاري المعالجة والتفكير الأكاديمي الشامل...</h4>
              <p className="text-[11px] text-indigo-700 font-medium animate-pulse">{LOADING_STEPS[loadingStep]}</p>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed max-w-sm mx-auto">
              ملاحظة: نقوم بتشغيل طاقة التفكير القصوى في Gemini لضمان خروج التلخيص بدقة متناهية وبلا أي معلومات مغلوطة.
            </p>
          </div>
        ) : (
          /* Submit Button */
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
            id="start-summary-btn"
          >
            <Send className="w-4 h-4" />
            <span>ابدأ التلخيص الذكي وتصدير الملاحظات</span>
          </button>
        )}

      </form>
    </div>
  );
}

