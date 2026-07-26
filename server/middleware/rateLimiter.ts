/**
 * Rate Limiter Middleware — حماية الـ API من الاستخدام المفرط
 */
import rateLimit from 'express-rate-limit';

/**
 * حماية عامة: 60 طلب/دقيقة لكل IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد دقيقة.'
  }
});

/**
 * حماية مشددة لعمليات التلخيص: 5 طلبات/دقيقة لكل IP
 */
export const summarizeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'يرجى الانتظار قبل إرسال طلب تلخيص جديد. الحد الأقصى 5 طلبات في الدقيقة.'
  }
});

/**
 * حماية لعمليات التصدير: 10 طلبات/دقيقة لكل IP
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'يرجى الانتظار قبل إرسال طلب تصدير جديد.'
  }
});
