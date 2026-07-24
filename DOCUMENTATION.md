# 📑 DOCUMENTATION.md | التوثيق الفني الشامل لمنصة YT-Summarizer AI

يوفر هذا المستند توثيقاً تقنياً معمارياً مفصلاً لمنصة **YT-Summarizer AI** المخصصة لتلخيص الفيديوهات الأكاديمية بواسطة الذكاء الاصطناعي ومزامنتها.

---

## 🏗️ 1. معمارية النظام (System Architecture)

يعتمد التطبيق على معمارية **Full-Stack Hybrid** تجمع بين:
- **Client (SPA)**: React 19 + Tailwind CSS + Lucide Icons مع معالجة حية للحالات والاستجابة الفورية.
- **Backend Server**: Node.js + Express + ESBuild مع دعم Vite Middleware في بيئة التطوير، والعمل كـ Serverless / Node Server جاهز للإنتاج.
- **Database & Auth**: Firebase Firestore لتخزين الملخصات وإعدادات المستخدمين، مع Firebase Auth لتسجيل الدخول الحقيقي عبر Google.
- **AI Core**: Google Gen AI SDK (`@google/genai`) مع استخدام نموذج `gemini-3.6-flash` للسرعة و `gemini-3.1-pro` للتحليل العميق.

---

## 🔌 2. توثيق واجهات البرمجة (API Endpoints Reference)

### 2.1 الفحوصات العامة وإدارة الحسابات
- **`GET /api/health`**
  - **الوصف**: فحص سلامة الخادم والاستجابة.
  - **الاستجابة**: `{ "status": "ok", "timestamp": "ISO-Date" }`

- **`GET /api/telegram-bot-info`**
  - **الوصف**: جلب اسم ومعلومات بوت تلغرام المرتبط بـ `TELEGRAM_BOT_TOKEN`.

- **`POST /api/save-user-config`**
  - **الوصف**: حفظ وتحديث إعدادات المفاتيح الخاصة بالمستخدم (Gemini API Key, Notion Token, Telegram ID).
  - **جسم الطلب**:
    ```json
    {
      "userId": "FIREBASE_UID",
      "configData": {
        "geminiApiKey": "AIzaSy...",
        "telegramId": "123456789",
        "notionCredentials": { "apiKey": "secret_...", "databaseId": "..." }
      }
    }
    ```

---

### 2.2 معالجة وتلخيص الفيديوهات (Video Processing Engine)
- **`POST /api/process-video`**
  - **الوصف**: بدء عملية تحليل وتلخيص فيديو يوتيوب بشكل غير متزامن (Asynchronous Background Processing) لمنع حدوث Timeout في Vercel / Cloud Run.
  - **جسم الطلب**:
    ```json
    {
      "videoUrl": "https://www.youtube.com/watch?v=EXAMPLE",
      "isPublic": true,
      "userId": "USER_ID",
      "userDisplayName": "اسم المستخدم",
      "language": "ar"
    }
    ```
  - **الاستجابة الفورية**:
    ```json
    {
      "success": true,
      "summaryId": "FIRESTORE_DOC_ID",
      "status": "processing"
    }
    ```

- **`GET /api/summary/:id`**
  - **الوصف**: الاستعلام عن حالة وناتج الملخص بواسطة المזהي ID.

- **`POST /api/document/refine`**
  - **الوصف**: إعادة تحسين وهيكلة النص بالذكاء الاصطناعي لصيغة أكاديمية موجهة للطباعة (مظهر جداول ماركداون، عناوين منسقة).

---

### 2.3 تصدير ومزامنة الملفات (Export & Integration Services)
- **`GET /api/export-file?id=DOC_ID&format=[word|pdf|markdown]`**
  - **الوصف**: إنشاء وتحميل الملفات الأكاديمية مباشرة:
    - `format=word`: يُنشئ ملف Microsoft Word (`.doc`) بحجم كامل وتنسيق ألوان أنيق.
    - `format=pdf`: يُنشئ صفحة طباعة ذاتية تفاعلية للطباعة والتنزيل المباشر بصيغة PDF.
    - `format=markdown`: يُحمل النص بصيغة `.md`.

- **`POST /api/notion/export`**
  - **الوصف**: إرسال الملخص إلى قاعدة بيانات Notion عبر Notion REST API مباشرة من الخادم لمنع مشكلات CORS.

---

## 🗄️ 3. هيكل قاعدة البيانات (Firestore Database Schema)

### 3.1 مجموعة `summaries`
تخزن كافة الملخصات والمدونات الناتجة:
```typescript
interface SummaryDocument {
  id: string;
  userId: string;
  userDisplayName: string;
  videoUrl: string;
  videoTitle?: string;
  videoId?: string;
  summaryText?: string;
  status: 'processing' | 'completed' | 'error';
  isPublic: boolean;
  language: 'ar' | 'en';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  error?: string;
}
```

### 3.2 مجموعة `users`
تخزن بيانات ومعرفات الربط الخاصة بالعملاء:
```typescript
interface UserProfileDocument {
  email?: string;
  displayName?: string;
  telegramId?: string;
  geminiApiKey?: string;
  notionCredentials?: {
    apiKey: string;
    databaseId: string;
  };
  updatedAt: Timestamp;
}
```

### 3.3 مجموعة `login_tokens`
تخزن رموز الدخول التلقائي المؤقتة المنشأة عبر بوت تلغرام:
```typescript
interface LoginTokenDocument {
  userId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp; // تنتهي صلاحيتها خلال 15 دقيقة
}
```

---

## 🤖 4. آلية عمل بوت تلغرام (Telegram Bot Architecture)

1. **الاستقبال الضمني**: يستقبل الخادم إشعارات Webhook من تلغرام عند إرسال أي فيديو أو أمر للبوت (`/start`, `/status`, `/latest`, `/login`).
2. **التحقق من الدخول (Auto-Login Link)**: يُنشئ الخادم رابط دخول آمن محتوي على Token فريد من نوعه يُمكّن المستخدم من فتح الموقع وهو مسجل الدخول تلقائياً دون الحاجة لكلمات مرور.
3. **التوليد والتنبيه**: عند انتهاء تلخيص الفيديو في الخلفية، يقوم البوت بإرسال إشعار مباشر في المحادثة مع أزرار تفاعلية لتنزيل ملفات Word الأكاديمية بنقرة واحدة.

---

## 🔐 5. إعدادات متغيرات البيئة لـ Vercel (Vercel Environment Setup)

عند النشر على منصة **Vercel**، قم بإضافة القيم التالية في قسم `Settings -> Environment Variables`:

### 5.1 المتغيرات الأساسية (Core App Environment Variables)
| Variable Name | Required | Example / Guidance |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **نعم** | مفتاحك من Google AI Studio لتوليد الملخصات. |
| `APP_URL` | **نعم** | رابط النشر على Vercel، مثال: `https://yt-summarizer.vercel.app`. |
| `TELEGRAM_BOT_TOKEN` | *اختياري* | التوكن من BotFather لتفعيل البوت الذكي. |

### 5.2 متغيرات مشروع Firebase الخاص (Optional Custom Firebase Project)
تأتي منصة YT-Summarizer بمشروع Firebase جاهز ومدمج ومعد افتراضياً. إذا أردت ربط تطبيقك بمشروع Firebase منفصل خاص بك، يمكنك إضافة المتغيرات التالية مع الرمز البادئ `VITE_`:

| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | *اختياري* | Web API Key لمشروعك في Firebase. |
| `VITE_FIREBASE_AUTH_DOMAIN` | *اختياري* | Auth Domain الخاص بمشروعك (e.g. `my-app.firebaseapp.com`). |
| `VITE_FIREBASE_PROJECT_ID` | *اختياري* | Project ID الخاص بمشروعك (e.g. `my-app-123`). |
| `VITE_FIREBASE_STORAGE_BUCKET` | *اختياري* | Storage Bucket (e.g. `my-app-123.firebasestorage.app`). |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | *اختياري* | Sender ID للمسجات والإشعارات. |
| `VITE_FIREBASE_APP_ID` | *اختياري* | Web App ID لمشروعك. |
| `VITE_FIREBASE_DATABASE_ID` | *اختياري* | معرّف قاعدة البيانات Firestore (افتراضياً `(default)` أو اسم القاعدة الخاص بك). |

---

## 🛠️ 6. الأوامر وسكريبتات البناء (Build & Test Scripts)

- **`npm run dev`**: تشغيل خادم المحلي عبر `tsx server.ts`.
- **`npm run build`**: تجميع ملفات الواجهة مع Vite وتجميع خادم Node عبر `esbuild` في مجلد `dist/server.cjs`.
- **`npm run lint`**: فحص الأخطاء والتحقق من سلامة الأنواع مع TypeScript compiler.
- **`npm run start`**: تشغيل الخادم المجمع للإنتاج `node dist/server.cjs`.
