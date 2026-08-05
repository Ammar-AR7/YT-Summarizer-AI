# 🎥 YT-Summarizer AI | منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini-3.6_Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Firebase Admin](https://img.shields.io/badge/Firebase-Admin_SDK-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Render Deployment](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=black)](https://render.com)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

منصة أكاديمية وتطبيق ويب متكامل مدعوم بالذكاء الاصطناعي (**Google Gemini 3.6 Flash**) لتحويل أي مقطع فيديو أو محاضرة على YouTube إلى ملخصات دراسية شاملة، تدوينات منظمة، ونقاط رئيسية بدقة عالية باللغتين العربية والإنجليزية.

---

## 🌟 أبرز المميزات (Key Features)

- 🤖 **تحليل ذكي بواسطة Google Gemini 3.6 Flash**: استخراج الهيكل التعليمي، المفاهيم الأساسية، الأكواد البرمجية، والأمثلة التوضيحية من أي رابط يوتيوب.
- 📁 **قسم الملخصات الشخصية (`[ملخصاتي]`)**: أرشيف خاص لكل مستخدم لعرض، بحث، وتصفح جميع ملخصاته (العامة والخاصة) وحذفها بسهولة.
- 👑 **نظام إدارة الأدمن المستقل (Admin Role & Secure Delete)**:
  - التحقق من بريد الأدمن عبر المتغير `ADMIN_EMAILS`.
  - حذف آمن لأي ملخص في المجتمع من قبل الأدمن أو صاحبه عبر الباك إند بافتراضية **Firebase Admin SDK** وتجاوز قيود المتصفح.
- 📱 **تحميل PDF مباشر ومخصص للجوال (`html2pdf.js`)**:
  - **على أجهزة الجوال**: توليد وتحميل ملف PDF مباشر وبطريقة تلقائية دون الحاجة لشاشة الطباعة أو وجود طابعة.
  - **على أجهزة الحاسوب**: طباعة مباشرة عالية الدقة بصيغة المتجهات (Vector PDF Print) مع تنسيق مرن ومنع قطعية الكلمات (`Word Wrap`).
- 📄 **تصدير أكاديمي متعدد الصيغ**:
  - **Microsoft Word (.doc)**: ملف منسق بالألوان والعناوين الأكاديمية والجداول.
  - **PDF مخصص ومستجيب**: تصدير مباشر مع ضبط تلقائي للهوامش وجداول منسقة.
  - **Markdown (.md)**: نصوص ماركداون خام جاهزة للاستخدام البرمجي والتدوين.
- 📝 **تكامل مباشر مع Notion**: مزامنة وحفظ الملخصات تلقائياً في قاعدة بيانات Notion الخاصة بك.
- 📱 **تكامل بوت تلغرام (Telegram Bot Integration)**:
  - يعمل 24/7 على خادم **Render** المستقل مع توجيه ثابت للروابط على **Vercel** (`FRONTEND_URL`).
  - إرسال روابط اليوتيوب للبوت مباشرة واستلام الملخص في ثوانٍ.
  - أزرار تفاعلية لتحميل ملفات Word الأكاديمية ومعاينة PDF والتصدير لـ Notion.
  - رابط تسجيل دخول آمن بـ **Auto-Login Token** دون الحاجة لإدخال كلمات مرور.
- 🎨 **تصميم مرن ومتجاوب 100% (Responsive Mobile Design)**:
  - شريط أزرار تصدير متكيف وقابل للتمرير أفقياً (`scrollbar-hide`).
  - احتواء الجداول والصور ومنع كسر الشاشات على الجوالات الصغيرة.
- 🧪 **اختبارات شاملة (Jest Unit & Integration Tests)**: اختبارات آلية تضمن جودة واستقرار جميع الوحدات.

---

## 🛠️ تقنيات المشروع (Tech Stack)

- **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide Icons, `html2pdf.js`.
- **Backend Architecture**: Node.js, Express (Clean Architecture), Firebase Admin SDK.
- **Security & Stability**: `express-rate-limit`, `helmet`, `escape-html`, Admin Email Checking.
- **AI Engine**: Google Gen AI SDK (`@google/genai`) using `gemini-3.6-flash`.
- **Database & Auth**: Firebase Firestore & Firebase Google Authentication.
- **Deployments**: Vercel (Frontend & Serverless API) + Render (Persistent Backend & Telegram Bot).

---

## 🏗️ هيكلية المشروع والملفات (Project Architecture)

```
YT-Summarizer-AI/
├── src/
│   ├── components/
│   │   ├── CommunityFeed.tsx       ← معرض ملخصات المجتمع + فحص وصلاحيات حذف الأدمن
│   │   ├── Header.tsx              ← الترويسة الرئيسية وتسجيل الدخول
│   │   ├── Hero.tsx                ← الواجهة الترحيبية والخصائص
│   │   ├── NotionSettings.tsx      ← ربط وتكيف حسابات Notion
│   │   ├── PersonalSummaries.tsx   ← [جديد] تبويب ملخصات المستخدم الشخصية
│   │   ├── SummarizerForm.tsx      ← نموذج إدخال روابط يوتيوب
│   │   └── SummaryViewer.tsx       ← عرض الملخص، التعديل، وشريط التصدير المتجاوب
│   ├── lib/
│   │   ├── pdfExport.ts            ← توليد طباعة PDF محلياً + التنزيل المباشر بالجوال (html2pdf)
│   │   ├── wordExport.ts           ← تصدير مستندات Word منسقة
│   │   └── firebase.ts             ← تهيئة عميل Firebase
│   ├── services/
│   │   ├── firebaseService.ts      ← خدمات الفايربيز للعميل وجلب ملخصات المستخدم
│   │   ├── geminiService.ts        ← توليد واستدعاء الذكاء الاصطناعي Gemini 3.6 Flash
│   │   ├── notionService.ts        ← خدمات المزامنة مع Notion
│   │   └── trialService.ts         ← تتبع الاستخدام التجريبي
│   └── types/
│       └── html2pdf.d.ts           ← [جديد] تعاريف TypeScript لمكتبة html2pdf.js
├── server/
│   ├── index.ts                    ← نقطة الدخول الرئيسية للخادم
│   ├── firebaseAdmin.ts            ← تهيئة Firebase Admin SDK
│   ├── middleware/
│   │   └── rateLimiter.ts          ← حماية Rate Limiting
│   ├── routes/
│   │   ├── videoRoutes.ts          ← معالجة الفيديوهات والملخصات + API الحذف الآمن
│   │   ├── authRoutes.ts           ← تسجيل الدخول بـ Token + API فحص الأدمن
│   │   ├── exportRoutes.ts         ← تصدير Word, PDF, Notion, Document Refinement
│   │   ├── telegramRoutes.ts       ← Webhooks البوت وتوجيه روابط Vercel
│   │   ├── trialRoutes.ts          ← فحص الاستخدام التجريبي
│   │   └── healthRoutes.ts         ← فحص صحة الخادم 24/7
│   ├── services/
│   │   ├── telegramBot.ts          ← معالجة أوامر ورسائل البوت
│   │   └── telegramPolling.ts      ← محرك Long Polling محلياً
│   └── helpers/
│       └── htmlExporter.ts         ← توليد مستندات HTML/PDF المنسقة على الخادم
```

---

## 🚀 التشغيل المحلي والاختبارات (Local Setup & Testing)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. تشغيل الاختبارات (Run Tests)
```bash
npm test
```

### 3. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
افتح المتصفح على: `http://localhost:3000`

### 4. اختبار التجميع والإنتاج (Production Build)
```bash
npm run build
npm start
```

---

## 🔑 متغيرات البيئة المطلوبة (Environment Variables)

قم بإنشاء ملف `.env` بناءً على `.env.example` وأضف المتغيرات التالية:

```env
# Gemini API Key
GEMINI_API_KEY=AIzaSy...

# Firebase Client Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Firebase Admin SDK (Server)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Telegram Bot Config
TELEGRAM_BOT_TOKEN=...
FRONTEND_URL=https://yt-summarizer-ai.vercel.app

# Admin Permissions
ADMIN_EMAILS=admin@example.com,youremail@gmail.com
```

---

## ☁️ استراتيجية النشر المزدوجة (Dual Deployment Strategy)

| المنصة | الدور | الرابط / التفاصيل |
|--------|-------|------------------|
| **Vercel** | يستضيف الواجهة الأمامية (Frontend) والـ Serverless API المباشرة. | `https://yt-summarizer-ai.vercel.app` |
| **Render** | يستضيف خادم Node.js المستقل المستمر 24/7 لتشغيل بوت تلغرام والـ APIs الثقيلة. | `https://yt-summarizer-ai-backend.onrender.com` |

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب رخصة **MIT**. يمكنك استخدامه، تعديله، وتطويره بحرية.
