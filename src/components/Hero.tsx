import React from 'react';
import { Sparkles, FileText, Bot, Languages, Download, Youtube } from 'lucide-react';

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50/90 via-indigo-50/20 to-white py-6 sm:py-12 px-3 sm:px-6 lg:px-8 border-b border-gray-100 relative overflow-hidden" id="app-hero">
      {/* Ambient background lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full bg-[radial-gradient(ellipse_at_top,rgba(224,231,255,0.45)_0%,transparent_70%)] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto text-center relative z-10" dir="rtl">
        
        {/* Badges Container */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 sm:mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-100 rounded-full text-[11px] sm:text-xs font-semibold text-indigo-900 shadow-xs leading-normal">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
            <span>مدعوم بنماذج Google Gemini AI المتطورة</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-100 rounded-full text-[11px] sm:text-xs font-semibold text-emerald-900 shadow-xs leading-normal">
            <Languages className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>دعم كامل للغة العربية والإنجليزية</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-sans font-extrabold text-xl sm:text-3xl md:text-4xl lg:text-5xl text-gray-900 tracking-tight leading-snug sm:leading-tight mb-3 sm:mb-5">
          منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي{' '}
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800">
            بالعربية والإنجليزية
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-base md:text-lg text-gray-600 max-w-3xl mx-auto mb-6 sm:mb-8 leading-relaxed font-sans px-2">
          حوّل أي فيديو أو محاضرة على YouTube إلى ملخص دراسي شامل، تدوينات منظمة، ونقاط رئيسية بدقة عالية. احفظ ملاحظاتك وصَدِّرها بسهولة بصيغة <span className="font-semibold text-gray-800">PDF, Word, Markdown, Notion</span> أو استلمها فوراً عبر بوت تلغرام!
        </p>

        {/* Feature Pills — Flex Container using div elements */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-10 text-[11px] sm:text-xs font-medium text-gray-700">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-xs leading-tight">
            <Youtube className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
            <span>جميع مقاطع يوتيوب والمحاضرات</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-xs leading-tight">
            <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span>Arabic & English Summaries</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-xs leading-tight">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span>تصدير PDF / Word / Markdown</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-xs leading-tight">
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
            <span>ربط تلقائي مع تلغرام & Notion</span>
          </div>
        </div>

        {/* Process Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-6 text-right">
          
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-sm sm:text-base mb-1.5">1. تلخيص وتدوين ذكي</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              تحليل شامل لمحتوى الفيديو بواسطة الذكاء الاصطناعي لاستخراج الهيكل العلمي، النقاط المفتاحية، والأكواد البرمجية باللغتين العربية والإنجليزية.
            </p>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-sm sm:text-base mb-1.5">2. تصدير وصيغ متعددة</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              تنسيق أكاديمي خالي من الأخطاء وجاهز للطباعة والاستخدام المباشر. حوّل الملخصات والملاحظات بسهولة إلى ملفات Word أو PDF أو مزامنتها مع Notion.
            </p>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-sm sm:text-base mb-1.5">3. تلغرام ومشاركة مجتمعية</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              أرسل رابط أي فيديو يوتيوب إلى البوت في تلغرام لتلقي الملخص فورياً، وشارك ملخصاتك في مكتبة المجتمع لتستفيد منها وتفيد الآخرين.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
