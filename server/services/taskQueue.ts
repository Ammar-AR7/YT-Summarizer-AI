/**
 * Task Queue Engine — طابور إدارة الطلبات المتزامنة للخادم
 * 
 * المزايا:
 * 1. حماية الخادم من استهلاك الذاكرة (Memory Spikes) عند وصول عدة طلبات في نفس الوقت
 * 2. منع تجاوز قيود المعدل (Rate Limits / 429 Errors) لـ Gemini API و YouTube Captions
 * 3. تشغيل عدد محدد من المهام بالتوازي (مثلاً مهمتان معاً) وتأجيل الباقي في الطابور بانتظام
 */

interface QueueItem {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

class TaskQueueManager {
  private queue: QueueItem[] = [];
  private activeCount: number = 0;
  private concurrencyLimit: number = 2; // الحد الأقصى للمهام المتزامنة في نفس الوقت

  constructor(concurrencyLimit: number = 2) {
    this.concurrencyLimit = concurrencyLimit;
  }

  /**
   * إدراج مهمة في الطابور وتشغيلها فور توفر مكان
   */
  public enqueue<T>(taskFn: () => Promise<T>, taskId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        id: taskId || `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        fn: taskFn,
        resolve,
        reject
      };

      this.queue.push(item);
      console.log(`[TaskQueue] 📥 Task added to queue (ID: ${item.id}). Pending in queue: ${this.queue.length}, Active: ${this.activeCount}`);
      
      this.next();
    });
  }

  /**
   * تشغيل المهمة التالية من الطابور مع مهلة زمنية (Timeout: 60s) لمنع تعليق الطابور
   */
  private next(): void {
    if (this.activeCount >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;
    console.log(`[TaskQueue] 🚀 Starting task execution (ID: ${item.id}). Active: ${this.activeCount}/${this.concurrencyLimit}`);

    // إنشاء مهلة زمنية للتنفيذ الفعلي فقط (60 ثانية)
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('⏳ استغرقت معالجة الفيديو وقتاً أطول من المتوقع (تجاوزت 60 ثانية). يرجى المحاولة لاحقاً.'));
      }, 60000);
    });

    Promise.race([item.fn(), timeoutPromise])
      .then((result) => {
        clearTimeout(timeoutId);
        console.log(`[TaskQueue] ✅ Task completed successfully (ID: ${item.id})`);
        item.resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error(`[TaskQueue] ❌ Task failed or timed out (ID: ${item.id}):`, error.message || error);
        item.reject(error);
      })
      .finally(() => {
        this.activeCount--;
        console.log(`[TaskQueue] 🔄 Slot freed. Active: ${this.activeCount}, Pending in queue: ${this.queue.length}`);
        this.next();
      });
  }

  /**
   * إحصائيات الطابور الحالية
   */
  public getStats() {
    return {
      activeCount: this.activeCount,
      pendingCount: this.queue.length,
      concurrencyLimit: this.concurrencyLimit
    };
  }
}

// تصدير كائن أحادي (Singleton) للطابور الرئيسي في الباك إند
export const videoTaskQueue = new TaskQueueManager(2);
