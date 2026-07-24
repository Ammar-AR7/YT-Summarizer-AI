import React from 'react';
import { Sparkles, FileText, Bot, Languages, Download, Layers, CheckCircle2, Youtube } from 'lucide-react';

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50/90 via-indigo-50/20 to-white py-8 sm:py-14 px-4 sm:px-6 lg:px-8 border-b border-gray-100 relative overflow-hidden" id="app-hero">
      {/* Ambient background lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent pointer-events-none"></div>

      <div className="max-w-5xl mx-auto text-center relative z-10" dir="rtl">
        
        {/* Badges Container */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-full text-[11px] sm:text-xs font-semibold text-indigo-900 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
            <span>مدعوم بنماذج Google Gemini 3.1 Pro المتطورة</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-emerald-100 rounded-full text-[11px] sm:text-xs font-semibold text-emerald-900 shadow-2xs">
            <Languages className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>دعم كامل للغة العربية والإنجليزية (Arabic & English)</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-sans font-extrabold text-2xl sm:text-4xl md:text-5xl text-gray-900 tracking-tight leading-snug mb-4 sm:mb-5">
          منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800">
            بالعربية والإنجليزية
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-base md:text-lg text-gray-600 max-w-3xl mx-auto mb-6 sm:mb-10 leading-relaxed font-sans">
          حوّل أي فيديو أو محاضرة على YouTube إلى ملخص دراسي شامل، تدوينات منظمة، ونقاط رئيسية بدقة عالية. احفظ ملاحظاتك وصَدِّرها بسهولة بصيغة <span className="font-semibold text-gray-800">PDF, Word, Markdown, Notion</span> أو استلمها فوراً عبر بوت تلغرام!
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-10 text-2xs sm:text-sm font-medium text-gray-700">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs">
            <Youtube className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
            جميع مقاطع يوتيوب والمحاضرات
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs">
            <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            Arabic & English Summaries
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            تصدير PDF / Word / Markdown
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-white border border-gray-200/90 rounded-xl shadow-2xs">
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
            ربط تلقائي مع تلغرام & Notion
          </span>
        </div>

        {/* Process Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-right">
          
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-base sm:text-lg mb-2">1. تلخيص وتدوين ذكي</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
              تحليل شامل لمحتوى الفيديو بواسطة الذكاء الاصطناعي لاستخراج الهيكل العلمي، النقاط المفتاحية، والأكواد البرمجية باللغتين العربية والإنجليزية.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-base sm:text-lg mb-2">2. تصدير وصيغ متعددة</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
              تنسيق أكاديمي خالي من الأخطاء وجاهز للطباعة والاستخدام المباشر. حوّل الملخصات والملاحظات بسهولة إلى ملفات Word أو PDF أو مزامنتها مع Notion.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 group text-right">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-gray-900 text-base sm:text-lg mb-2">3. تلغرام ومشاركة مجتمعية</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
              أرسل رابط أي فيديو يوتيوب إلى البوت في تلغرام لتلقي الملخص فورياً، وشارك ملخصاتك في مكتبة المجتمع لتستفيد منها وتفيد الآخرين.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

