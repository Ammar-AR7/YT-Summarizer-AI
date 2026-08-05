import React from 'react';
import { Sparkles, FileText, Bot, Languages, Download, Youtube } from 'lucide-react';

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50 via-indigo-50/20 to-white py-6 sm:py-10 px-3 sm:px-6 lg:px-8 border-b border-gray-100 relative overflow-hidden" id="app-hero">
      <div className="max-w-5xl mx-auto text-center relative z-10" dir="rtl">
        
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-full text-[11px] font-bold text-indigo-900 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
            مدعوم بنماذج Google Gemini AI المتطورة
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-900 shadow-xs">
            <Languages className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            دعم كامل للغة العربية والإنجليزية
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-sans font-extrabold text-xl sm:text-3xl md:text-4xl lg:text-5xl text-gray-900 tracking-tight leading-snug sm:leading-tight mb-3">
          منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي{' '}
          <span className="inline-block text-indigo-600">
            بالعربية والإنجليزية
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-base text-gray-600 max-w-3xl mx-auto mb-6 leading-relaxed font-sans px-2">
          حوّل أي فيديو أو محاضرة على YouTube إلى ملخص دراسي شامل، تدوينات منظمة، ونقاط رئيسية بدقة عالية. احفظ ملاحظاتك وصَدِّرها بسهولة بصيغة <span className="font-bold text-gray-800">PDF, Word, Markdown, Notion</span> أو استلمها فوراً عبر بوت تلغرام!
        </p>

        {/* Feature Pills — Clean Bulletproof Responsive Grid */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 mb-8 text-[11px] font-semibold text-gray-700 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-xs">
            <Youtube className="w-4 h-4 text-red-500 shrink-0" />
            <span>جميع مقاطع يوتيوب</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-xs">
            <Languages className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Arabic & English</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-xs">
            <Download className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تصدير PDF / Word</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 p-2 bg-white border border-gray-200 rounded-xl shadow-xs">
            <Bot className="w-4 h-4 text-sky-500 shrink-0" />
            <span>ربط تلغرام & Notion</span>
          </div>
        </div>

        {/* Process Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
          
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs text-right">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">1. تلخيص وتدوين ذكي</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              تحليل شامل لمحتوى الفيديو بواسطة الذكاء الاصطناعي لاستخراج الهيكل العلمي والنقاط المفتاحية.
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs text-right">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">2. تصدير وصيغ متعددة</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              تنسيق أكاديمي جاهز للطباعة والاستخدام المباشر. حوّل الملخصات إلى ملفات Word أو PDF أو Notion.
            </p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs text-right">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3">
              <Bot className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">3. تلغرام ومشاركة مجتمعية</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              أرسل رابط أي فيديو إلى البوت في تلغرام لتلقي الملخص فورياً، وشارك ملخصاتك في مكتبة المجتمع.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
