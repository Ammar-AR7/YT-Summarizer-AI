# 📖 DOCUMENTATION.md — التوثيق المعماري الشامل لمنصة YT-Summarizer AI

> **تاريخ آخر تحديث:** 5 أغسطس 2026  
> **الإصدار:** 2.5.0 (Admin System, Personal Summaries, Mobile Direct PDF & Responsive Design)

---

## 📌 جدول المحتويات
1. [المقدمة والنظرة العامة](#1-المقدمة-والنظرة-العامة)
2. [المعمارية والهيكلية البرمجية (Clean Architecture)](#2-المعمارية-والهيكلية-البرمجية)
3. [دليل نقاط النهاية للـ API (API Reference)](#3-دليل-نقاط-النهاية-للـ-api)
4. [مخطط قواعد البيانات (Firestore Database Schema)](#4-مخطط-قواعد-البيانات)
5. [نظام إدارة الأدمن والملخصات الشخصية](#5-نظام-إدارة-الأدمن-والملخصات-الشخصية)
6. [محرك التصدير والتوافق مع الجوال (PDF & Mobile Export Engine)](#6-محرك-التصدير-والتوافق-مع-الجوال)
7. [نظام بوت تلغرام (Telegram Bot System)](#7-نظام-بوت-تلغرام)
8. [الأمان والحماية (Security & Rate Limiting)](#8-الأمان-والحماية)
9. [دليل النشر والتشغيل (Deployment Guide)](#9-دليل-النشر-والتشغيل)

---

## 1. المقدمة والنظرة العامة

منصة **YT-Summarizer AI** هي تطبيق دراسي وأكاديمي متكامل يعتمد على نماذج الذكاء الاصطناعي **Google Gemini 3.6 Flash** لتحويل مقاطع فيديو يوتيوب والمحاضرات إلى ملخصات دراسية مهيكلة بدقة باللغتين العربية والإنجليزية.

تتميز المنصة بتكاملها الشامل مع خدمات متعددة:
- **Personal Archive (`[ملخصاتي]`)**: قسم مخصص لكل مستخدم لإدارة وتصفح ملخصاته العامة والخاصة والبحث فيها.
- **Admin Delete System**: نظام حماية وإدارة يسمح للمشرفين وحاملي صلاحية الأدمن بحذف أي ملخص عبر خادم الباك إند بواسطة Firebase Admin SDK.
- **Smart Mobile PDF Export**: كشف تلقائي لأجهزة الجوال وتوليد ملف PDF مباشر وتنزيله عبر `html2pdf.js` بدون الاستعانة بالحوار الخاص بالطباعة.
- **Notion**: تصدير مباشر لصفحات وقواعد بيانات المستخدمين.
- **Telegram**: بوت تفاعلي كامل يدعم تحويل الفيديوهات وتنزيل المستندات وتوجيه الروابط دائماً لموقع Vercel الرئيسي (`FRONTEND_URL`).
- **Export Engine**: تصدير المستندات بصيغ Word (.doc), PDF للطباعة المباشرة والتنزيل, و Markdown.

---

## 2. المعمارية والهيكلية البرمجية

تم تصميم جانب الخادم (Backend) باتباع مبادئ **Clean Architecture** وفصل المسؤوليات (Single Responsibility Principle) إلى وحدات مستقلة داخل مجلد `server/`:

### 📂 مجلدات الخادم:
- `server/firebaseAdmin.ts`: إدارة الاتصال بقواعد Firestore بصلاحيات الخادم الكاملة (Admin SDK) لتجاوز قيود أمان المتصفح بشكل آمن عند الحذف أو الاستعلام.
- `server/routes/`: يحتوي على جميع المسارات البرمجية مقسمة حسب المجال:
  - `videoRoutes.ts`: معالجة الفيديوهات، توليد الملخصات، ومسار الحذف الآمن للملخصات (`/api/summary/delete`).
  - `authRoutes.ts`: تسجيل الدخول بـ Token، حفظ الإعدادات، ومسار فحص حالة الأدمن (`/api/admin/check`).
  - `exportRoutes.ts`: تصدير Word, PDF, Markdown, Notion, وتنسيق المستندات بالذكاء الاصطناعي.
  - `telegramRoutes.ts`: استقبال Webhooks وتوجيه أزرار وروابط البوت إلى Vercel.
  - `trialRoutes.ts` & `healthRoutes.ts`: فحص فترة التجربة وصحة الخادم 24/7.
- `server/services/`: يحتوي على منطق الأعمال الأساسي (Gemini API logic, Telegram Bot logic, Trial logic).
- `server/helpers/`: يحتوي على الدوال المساعدة المستقلة (HTML/PDF generation with responsive Word Wrap, Login token generation, User lookup).
- `server/middleware/`: طبقات الحماية وتحديد معدل الطلبات (`rateLimiter.ts`).

---

## 3. دليل نقاط النهاية للـ API (API Reference)

جميع المسارات تبدأ بـ `/api`:

### 🎥 1. مسارات الفيديوهات والملخصات

#### `POST /api/process-video`
- **الوصف:** معالجة رابط فيديو يوتيوب وتوليد الملخص دراسياً.
- **معدل الحماية:** 5 طلبات / دقيقة لكل IP.
- **Body:**
  ```json
  {
    "videoUrl": "https://www.youtube.com/watch?v=...",
    "language": "ar",
    "userId": "user_123",
    "userDisplayName": "أحمد",
    "isPublic": true,
    "geminiApiKey": "AIzaSy..." // اختياري
  }
  ```

#### `GET /api/summary/:id`
- **الوصف:** جلب بيانات ملخص محدد بالمعرّف.

#### `POST /api/summary/delete`
- **الوصف:** حذف ملخص محدد بآمان من Firestore عبر Firebase Admin SDK.
- **التحقق:** يتحقق الخادم أن منفذ الطلب هو إما صاحب الملخص (`userId`) أو أدمن مسجل في `ADMIN_EMAILS`.
- **Body:**
  ```json
  {
    "summaryId": "doc_xyz123",
    "userEmail": "admin@example.com",
    "userId": "user_123"
  }
  ```

---

### 🔑 2. مسارات المصادقة والحسابات والأدمن

#### `GET /api/admin/check?email=user@example.com`
- **الوصف:** فحص هل البريد الإلكتروني ينتمي إلى قائمة مدراء النظام `ADMIN_EMAILS`.
- **Response:**
  ```json
  {
    "isAdmin": true
  }
  ```

#### `POST /api/auth/login-with-token`
- **الوصف:** التحقق من رمز الدخول المؤقت المولّد من بوت تلغرام واسترجاع بيانات جلسة المستخدم.

#### `POST /api/save-user-config`
- **الوصف:** حفظ مفتاح Gemini API الخاص بالمستخدم أو بيانات اعتماد Notion.

---

## 4. مخطط قواعد البيانات (Firestore Database Schema)

### 📁 Collection: `users`
```typescript
interface UserDocument {
  email?: string;
  displayName?: string;
  telegramId?: string;
  telegramUsername?: string;
  geminiApiKey?: string;
  notionCredentials?: {
    apiKey: string;
    databaseId: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 📁 Collection: `summaries`
```typescript
interface SummaryDocument {
  userId: string;
  userDisplayName: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  summaryText: string;
  language: string;
  status: 'processing' | 'completed' | 'error';
  isPublic: boolean;
  error?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

---

## 5. نظام إدارة الأدمن والملخصات الشخصية

### 👑 نظام الأدمن (Admin System):
- يتم تحديد المدراء عن طريق متغير البيئة `ADMIN_EMAILS` في Vercel / Render (مفصولة بفاصلة).
- يتيح للأدمن ظهور زر **[حذف]** على جميع الملخصات في المعرض العام والخاص.
- يتم الحذف من خلال الباك إند عبر `POST /api/summary/delete` الذي يستدعي **Firebase Admin SDK** لتجاوز قيود أمان عميل الفايربيز بدون مشاكل صلاحيات.

### 📂 قسم الملخصات الشخصية (`PersonalSummaries.tsx`):
- يظهر في التبويب الجديد **`[ملخصاتي]`** في الواجهة الرئيسية.
- يجلب جميع ملخصات المستخدم الحالي ( العامة والخاصة `isPublic: true/false` ) عبر الاستعلام `where('userId', '==', user.uid)`.
- يوفر إمكانية الفلترة والبحث المباشر والحذف والاطلاع الفوري على الملخصات.

---

## 6. محرك التصدير والتوافق مع الجوال (PDF & Mobile Export Engine)

### 📱 آلية التصدير الذكي للـ PDF (`pdfExport.ts`):
1. **كشف جهاز العميل (`isMobileDevice`)**:
   - يتم كشف نوع الجهاز عبر `navigator.userAgent` وعرض الشاشة (`window.innerWidth <= 768`).
2. **العمل على الجوال (Mobile Mode)**:
   - يتم استخدام مكتبة `html2pdf.js` بشكل ديناميكي لتشيد عنصر HTML في الذاكرة وتحويله كـ Canvas ومن ثم توليد ملف PDF حقيقي `.pdf` وتنزيله فوراً لجهاز المستخدم دون الحاجة لفتح حوار الطباعة أو وجود طابعة.
3. **العمل على الحاسوب (Desktop Mode)**:
   - فتح نافذة طباعة المتصفح المباشرة (`window.print`) لتصدير مستند عالي الجودة والوضوح مع استجابة مرنة لجميع الهوامش والتفاف النصوص (Word Wrap).

---

## 7. نظام بوت تلغرام (Telegram Bot System)

يعمل بوت تلغرام عبر مسارين:
1. **Long Polling (`telegramPolling.ts`):** مخصص للتطوير المحلي ولخوادم Render المستقلة 24/7.
2. **Webhook (`telegramRoutes.ts`):** مخصص لاستقبال التحديثات من تلغرام مباشرة عبر HTTP POST `/api/telegram-webhook`.

### تثبيت رابط الواجهة على Vercel:
- تم تثبيت استخدام `FRONTEND_URL` (أو `https://yt-summarizer-ai.vercel.app`) كـ `baseUrl` لجميع روابط وأزرار البوت، مما يضمن فتح موقع Vercel دائماً حتى لو كان الخادم المنفذ للبوت موجوداً على Render.

---

## 8. الأمان والحماية (Security & Rate Limiting)

- **Firebase Rules**: حماية قاعدة بيانات Firestore وتخصيص صلاحيات القراءة والكتابة فقط لصاحب الحساب المستهدف.
- **Firebase Admin SDK**: استخدام الباك إند بصلاحيات خادم منفصلة لضمان تنفيذ عمليات الحذف الحساسة بدون تعريض القواعد للثغرات.
- **Express Rate Limit**:
  - `generalLimiter`: 60 طلب/دقيقة لكل IP.
  - `summarizeLimiter`: 5 طلبات/دقيقة لكل IP.
  - `exportLimiter`: 10 طلبات/دقيقة لكل IP.
- **Helmet Middleware**: حماية الترويسات ومنع هجمات الحقن و XSS.

---

## 9. دليل النشر والتشغيل (Deployment Guide)

1. **الواجهة الأمامية (Vercel):** يتم الرفع التلقائي عند ربط المستودع في GitHub.
2. **الخادم المستقل (Render):** تم إنشاء خدمة `yt-summarizer-ai-backend` وتفعيلها تلقائياً على خوادم Render للاستمرارية بنسبة 100%.

---

© 2026 YT-Summarizer AI • جميع الحقوق محفوظة.
