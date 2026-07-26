# 📖 DOCUMENTATION.md — التوثيق المعماري الشامل لمنصة YT-Summarizer AI

> **تاريخ آخر تحديث:** 26 يوليو 2026  
> **الإصدار:** 2.0.0 (Clean Architecture & Multi-Platform Deployment)

---

## 📌 جدول المحتويات
1. [المقدمة والنظرة العامة](#1-المقدمة-والنظرة-العامة)
2. [المعمارية والهيكلية البرمجية (Clean Architecture)](#2-المعمارية-والهيكلية-البرمجية)
3. [دليل نقاط النهاية للـ API (API Reference)](#3-دليل-نقاط-النهاية-للـ-api)
4. [مخطط قواعد البيانات (Firestore Database Schema)](#4-مخطط-قواعد-البيانات)
5. [نظام بوت تلغرام (Telegram Bot System)](#5-نظام-بوت-تلغرام)
6. [الأمان والحماية (Security & Rate Limiting)](#6-الأمان-والحماية)
7. [دليل النشر والتشغيل (Deployment Guide)](#7-دليل-النشر-والتشغيل)

---

## 1. المقدمة والنظرة العامة

منصة **YT-Summarizer AI** هي تطبيق دراسي وأكاديمي متكامل يعتمد على نماذج الذكاء الاصطناعي **Google Gemini 3.6 Flash** لتحويل مقاطع فيديو يوتيوب والمحاضرات إلى ملخصات دراسية مهيكلة بدقة باللغتين العربية والإنجليزية.

تتميز المنصة بتكاملها الشامل مع خدمات متعددة:
- **Notion**: تصدير مباشر لصفحات وقواعد بيانات المستخدمين.
- **Telegram**: بوت تفاعلي كامل يدعم تحويل الفيديوهات وتنزيل المستندات بدون مغادرة تلغرام.
- **Export Engine**: تصدير المستندات بصيغ Word (.doc), PDF للطباعة المباشرة, و Markdown.

---

## 2. المعمارية والهيكلية البرمجية

تم تصميم جانب الخادم (Backend) باتباع مبادئ **Clean Architecture** وفصل المسؤوليات (Single Responsibility Principle) إلى وحدات مستقلة داخل مجلد `server/`:

### 📂 مجلدات الخادم:
- `server/firebaseAdmin.ts`: إدارة الاتصال بقواعد Firestore بصلاحيات الخادم الكاملة (Admin SDK) لتجاوز قيود أمان المتصفح بشكل آمن.
- `server/routes/`: يحتوي على جميع المسارات البرمجية مقسمة حسب المجال (الفيديو، المصادقة، التصدير، الفترة التجريبية، تلغرام، فحص الصحة).
- `server/services/`: يحتوي على منطق الأعمال الأساسي (Gemini API logic, Telegram Bot logic, Trial logic).
- `server/helpers/`: يحتوي على الدوال المساعدة المستقلة (HTML generation, Login token generation, Telegram API wrappers, User lookup).
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
- **Response (Synchronous Completion):**
  ```json
  {
    "success": true,
    "summaryId": "doc_xyz123",
    "status": "completed",
    "summary": "# عنوان الملخص...",
    "videoTitle": "اسم الفيديو",
    "videoId": "v_123"
  }
  ```

#### `GET /api/summary/:id`
- **الوصف:** جلب بيانات ملخص محدد بالمعرّف.

---

### 🔑 2. مسارات المصادقة والحسابات

#### `POST /api/auth/login-with-token`
- **الوصف:** التحقق من رمز الدخول المؤقت المولّد من بوت تلغرام واسترجاع بيانات جلسة المستخدم.

#### `POST /api/save-user-config`
- **الوصف:** حفظ مفتاح Gemini API الخاص بالمستخدم أو بيانات اعتماد Notion.

---

### 📄 3. مسارات التصدير والتحسين

#### `GET /api/export-file?id=:id&format=:format`
- **الصيغ المدعومة (`format`):** `word`, `pdf`, `markdown`.
- **الوصف:** توليد وإرجاع ملف منسّق بالألوان والجداول والـ RTL العربية.

#### `POST /api/notion/export`
- **الوصف:** تصدير الملخص مباشرة إلى قاعدة بيانات Notion الخاصة بالمستخدم.

#### `POST /api/document/refine`
- **الوصف:** استخدام Gemini لتهيئة وتنسيق الملخص وتحويل المفاهيم إلى جداول الماركداون قبل التصدير.

---

### 🏥 4. مسار الصحة والمراقبة

#### `GET /api/health`
- **الوصف:** فحص حالة السيرفر ومدة التشغيل (تُستخدم من قبل UptimeRobot لمنع السيرفر من النوم).

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

### 📁 Collection: `login_tokens`
```typescript
interface LoginTokenDocument {
  userId: string;
  createdAt: Date;
  expiresAt: Date; // 15 دقيقة صلاحية
}
```

### 📁 Collection: `trial_usage`
```typescript
interface TrialUsageDocument {
  lastTrialAt: number;
  trialCount: number;
  updatedAt: Date;
}
```

---

## 5. نظام بوت تلغرام (Telegram Bot System)

يعمل بوت تلغرام عبر مسارين:
1. **Long Polling (`telegramPolling.ts`):** مخصص للتطوير المحلي ولخوادم Render المستقلة 24/7.
2. **Webhook (`telegramRoutes.ts`):** مخصص لاستقبال التحديثات من تلغرام مباشرة عبر HTTP POST `/api/telegram-webhook`.

### الأوامر التفاعلية في تلغرام:
- `/start` — ترحيب برابط منصة الويب الزمني وتوليد Token دخول تلقائي.
- `/account` — عرض حالة ربط الحساب ومفاتيح المستخدم.
- `/latest` — عرض وقراءة وإجراء خيارات التصدير لأحدث ملخص للمستخدم.

---

## 6. الأمان والحماية (Security & Rate Limiting)

- **Firebase Rules**: حماية قاعدة بيانات Firestore وتخصيص صلاحيات القراءة والكتابة فقط لصاحب الحساب المستهدف.
- **Firebase Admin SDK**: استخدام الباك إند بصلاحيات خادم منفصلة لمنع تسريب المفاتيح.
- **Express Rate Limit**:
  - `generalLimiter`: 60 طلب/دقيقة لكل IP.
  - `summarizeLimiter`: 5 طلبات/دقيقة لكل IP.
  - `exportLimiter`: 10 طلبات/دقيقة لكل IP.
- **Helmet Middleware**: حماية الترويسات ومنع هجمات الحقن و XSS.

---

## 7. دليل النشر والتشغيل (Deployment Guide)

1. **الواجهة الأمامية (Vercel):** يتم الرفع التلقائي عند ربط المستودع في GitHub.
2. **الخادم المستقل (Render):** تم إنشاء خدمة `yt-summarizer-ai-backend` وتفعيلها تلقائياً على خوادم Render للاستمرارية بنسبة 100%.

---
© 2026 YT-Summarizer AI • جميع الحقوق محفوظة.
