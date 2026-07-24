# 🎥 YT-Summarizer AI | منصة تلخيص مقاطع يوتيوب ودفتر الملاحظات الذكي

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini API](https://img.shields.io/badge/Google_Gemini-3.1_Pro_/_3.6_Flash-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore_&_Auth-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Telegram Bot](https://img.shields.io/badge/Telegram_Bot-API-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

منصة أكاديمية وتطبيق ويب متكامل مدعوم بالذكاء الاصطناعي (**Google Gemini**) لتحويل أي مقطع فيديو أو محاضرة على YouTube إلى ملخصات دراسية شاملة، تدوينات منظمة، ونقاط رئيسية بدقة عالية باللغتين العربية والإنجليزية.

---

## 🌟 أبرز المميزات (Key Features)

- 🤖 **تحليل ذكي بواسطة Google Gemini**: استخراج الهيكل التعليمي، المفاهيم الأساسية، الأكواد البرمجية، والأمثلة التوضيحية من أي رابط يوتيوب.
- 🌍 **دعم ثنائي اللغة (Arabic & English)**: اختيار لغة الملخص الناتجة بسهولة وسلاسة.
- 📄 **تصدير أكاديمي متعدد الصيغ**:
  - **Microsoft Word (.doc)**: ملف منسق بالألوان والعناوين الأكاديمية والجداول.
  - **PDF مخصص للطباعة**: فتح نافذة الطباعة التلقائية مع تنسيق احترافي جاهز للفظ مباشرة.
  - **Markdown (.md)**: نصوص ماركداون خام جاهزة للاستخدام البرمجي والتدوين.
- 📝 **تكامل مباشر مع Notion**: مزامنة وحفظ الملخصات تلقائياً في قاعدة بيانات Notion الخاصة بك.
- 📱 **تكامل بوت تلغرام (Telegram Bot Integration)**:
  - إرسال روابط اليوتيوب للبوت مباشرة واستلام الملخص.
  - أزرار تفاعلية لتحميل ملفات Word الأكاديمية والتصدير.
  - رابط تسجيل دخول آمن بـ **Auto-Login Token** دون الحاجة لإدخال كلمات مرور.
- 🌐 **تغذية مجتمعية (Community Feed)**: مشاركة الملخصات العامة في مكتبة مجتمعية يستفيد منها الجميع.
- 📱 **واجهة تجاوب كاملة (Mobile-First Responsive)**: تصميم عصري مريح للعين ومتوافق تماماً مع جميع الهواتف الذكية والشاشات.

---

## 🛠️ تقنيات المشروع (Tech Stack)

- **Frontend**: React 19, Vite 6, Tailwind CSS v4, Lucide Icons, Motion Animation.
- **Backend**: Node.js, Express, ESBuild.
- **AI Model**: Google Gen AI SDK (`@google/genai`) using `gemini-3.6-flash` & `gemini-3.1-pro`.
- **Database & Auth**: Firebase Firestore & Firebase Google Authentication.
- **Bot Engine**: Telegram Bot Webhook & REST API.

---

## 🚀 التشغيل المحلي (Local Setup)

### 1. استنساخ المستودع (Clone Repository)
```bash
git clone https://github.com/YOUR_USERNAME/yt-summarizer-ai.git
cd yt-summarizer-ai
```

### 2. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 3. إعداد متغيرات البيئة (Environment Variables)
قم بإنشاء ملف `.env` بناءً على `.env.example`:
```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
```

### 4. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
افتح المتصفح على: `http://localhost:3000`

---

## ☁️ دليل النشر على Vercel (Vercel Deployment Guide)

لنشر هذا المشروع على **Vercel** بكل سهولة، اتبع الخطوات التالية:

### الخطوة 1: رفع المشروع على GitHub
1. أنشئ مستودعاً جديداً على حسابك في GitHub (New Repository).
2. قم برفع كود المشروع:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - YT Summarizer AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/yt-summarizer-ai.git
   git push -u origin main
   ```

### الخطوة 2: ربط المستودع بـ Vercel
1. سجل الدخول إلى منصة [Vercel](https://vercel.com).
2. اضغط على **"Add New Project"** ثم اختر **GitHub**.
3. حدد مستودع `yt-summarizer-ai`.

### الخطوة 3: إدخال متغيرات البيئة (Environment Variables) في Vercel
في صفحة إعدادات المشروع على Vercel (**Environment Variables**)، أدخل المتغيرات التالية:

| اسم المتغير (Key) | الوصف (Description) | القيمة المطلوبة (Value Example) |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | مفتاح API الخاص بـ Gemini من Google AI Studio *(إجباري)* | `AIzaSy...` |
| `APP_URL` | رابط تطبيقك بعد النشر على Vercel *(إجباري للبوت)* | `https://your-app-name.vercel.app` |
| `TELEGRAM_BOT_TOKEN` | توكن بوت تلغرام من BotFather *(اختياري)* | `123456789:ABCdef...` |

### الخطوة 4: النشر (Deploy)
- اضغط على **Deploy**. ستقوم Vercel ببناء الواجهة والخادم التلقائي بنجاح.

---

## 📖 التوثيق الشامل (Comprehensive Documentation)

للحصول على شرح تفصيلي عن الهيكلية البرمجية، نقاط نهاية الـ API (API Endpoints)، ومخطط قواعد البيانات (Database Schema)، يرجى الاطلاع على ملف [DOCUMENTATION.md](./DOCUMENTATION.md).

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب رخصة **MIT**. يمكنك استخدامه، تعديله، وتطويره بحرية.
