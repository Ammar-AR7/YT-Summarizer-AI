# 🎥 YT-Summarizer AI | منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini-3.6_Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Firebase Admin](https://img.shields.io/badge/Firebase-Admin_SDK-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Render Deployment](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=black)](https://render.com)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

منصة أكاديمية وتطبيق ويب متكامل مدعوم بالذكاء الاصطناعي (**Google Gemini**) لتحويل أي مقطع فيديو أو محاضرة على YouTube إلى ملخصات دراسية شاملة، تدوينات منظمة، ونقاط رئيسية بدقة عالية باللغتين العربية والإنجليزية.

---

## 🌟 أبرز المميزات (Key Features)

- 🤖 **تحليل ذكي بواسطة Google Gemini**: استخراج الهيكل التعليمي، المفاهيم الأساسية، الأكواد البرمجية، والأمثلة التوضيحية من أي رابط يوتيوب.
- 🏗️ **معمارية مفرّقة ونظيفة (Clean Architecture)**: تقسيم الخادم كلياً إلى مجلدات مخصصة (`server/routes`, `server/services`, `server/helpers`, `server/middleware`).
- 🛡️ **حماية أمنية بـ Firebase Admin SDK & Rate Limiting**: صلاحيات كاملة للخادم لتجاوز القواعد الأمنية المفروضة على المتصفح، مع حماية المسارات بـ `express-rate-limit` و `helmet`.
- 🌍 **دعم ثنائي اللغة (Arabic & English)**: اختيار لغة الملخص الناتجة بسهولة وسلاسة.
- 📄 **تصدير أكاديمي متعدد الصيغ**:
  - **Microsoft Word (.doc)**: ملف منسق بالألوان والعناوين الأكاديمية والجداول.
  - **PDF مخصص للطباعة**: طباعة مباشرة بجودة متجهة (Vector Print).
  - **Markdown (.md)**: نصوص ماركداون خام جاهزة للاستخدام البرمجي والتدوين.
- 📝 **تكامل مباشر مع Notion**: مزامنة وحفظ الملخصات تلقائياً في قاعدة بيانات Notion الخاصة بك.
- 📱 **تكامل بوت تلغرام (Telegram Bot Integration)**:
  - يعمل 24/7 على خادم **Render** المستقل.
  - إرسال روابط اليوتيوب للبوت مباشرة واستلام الملخص.
  - أزرار تفاعلية لتحميل ملفات Word الأكاديمية ومعاينة PDF والتصدير لـ Notion.
  - رابط تسجيل دخول آمن بـ **Auto-Login Token** دون الحاجة لإدخال كلمات مرور.
- 🧪 **اختبارات شاملة (Jest Unit & Integration Tests)**: اختبارات آلية تضمن جودة واستقرار جميع الوحدات.

---

## 🛠️ تقنيات المشروع (Tech Stack)

- **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide Icons.
- **Backend Architecture**: Node.js, Express (Modular Architecture), Firebase Admin SDK.
- **Security & Stability**: `express-rate-limit`, `helmet`, `escape-html`.
- **AI Engine**: Google Gen AI SDK (`@google/genai`) using `gemini-3.6-flash`.
- **Database & Auth**: Firebase Firestore & Firebase Google Authentication.
- **Deployments**: Vercel (Frontend & Serverless API) + Render (Persistent Backend & Telegram Bot).

---

## 🏗️ هيكلية ملفات الخادم (Server Architecture)

```
server/
├── index.ts                    ← نقطة الدخول الرئيسية للخادم
├── firebaseAdmin.ts            ← تهيئة Firebase Admin SDK
├── middleware/
│   └── rateLimiter.ts          ← حماية Rate Limiting (عام، تلخيص، تصدير)
├── routes/
│   ├── videoRoutes.ts          ← معالجة الفيديوهات والملخصات (Sync & Async)
│   ├── authRoutes.ts           ← تسجيل الدخول بـ Token وحفظ الإعدادات
│   ├── exportRoutes.ts         ← تصدير Word, PDF, Markdown, Notion, Document Refinement
│   ├── telegramRoutes.ts       ← استقبال Webhooks الخاصة ببوت تلغرام
│   ├── trialRoutes.ts          ← فحص فترة الانتظار الاستخدام التجريبي
│   └── healthRoutes.ts         ← فحص صحة الخادم والمراقبة 24/7
├── services/
│   ├── telegramBot.ts          ← المحرك الرئيسي لمعالجة أوامر ورسائل تلغرام
│   ├── telegramPolling.ts      ← محرك Long Polling محلياً
│   └── trialService.ts         ← خدمة التتبع التجريبي بـ Admin SDK
└── helpers/
    ├── htmlExporter.ts         ← توليد محتوى HTML وتنسيق الجداول والعناوين
    ├── userLookup.ts           ← البحث عن الحسابات وربط حسابات تلغرام
    └── loginToken.ts           ← إنشاء والتحقق من رموز الدخول المؤقتة
```

---

## 🚀 التشغيل المحلي والاختبارات (Local Setup & Testing)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. إشغيل الاختبارات (Run Tests)
```bash
npm test
```

### 3. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
افتح المتصفح على: `http://localhost:3000`

### 4. اختبار التجميع والتجربة للإنتاج (Production Build)
```bash
npm run build
npm start
```

---

## ☁️ استراتيجية النشر المزدوجة (Dual Deployment Strategy)

| المنصة | الدور | الرابط / التفاصيل |
|--------|-------|------------------|
| **Vercel** | يستضيف الواجهة الأمامية (Frontend) والـ Serverless API المباشرة. | `https://your-app.vercel.app` |
| **Render** | يستضيف خادم Node.js المستقل المستمر 24/7 لتشغيل بوت تلغرام والـ APIs. | `https://yt-summarizer-ai-backend.onrender.com` |

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب رخصة **MIT**. يمكنك استخدامه، تعديله، وتطويره بحرية.
