/**
 * PDF Generator — مولّد ملفات PDF حقيقية على السيرفر
 * 
 * يستخدم مكتبة PDFKit مع خط Cairo العربي لتحويل نصوص Markdown
 * إلى مستندات PDF منسقة بحجم A4 مع دعم كامل للغة العربية (RTL).
 * 
 * الخصائص:
 * - ترويسة أكاديمية أنيقة مع عنوان الفيديو ورابط المصدر
 * - عناوين H1/H2/H3 بأنماط مختلفة (خطوط فاصلة، خلفيات ملوّنة)
 * - قوائم نقطية (●) ورقمية (1. 2. 3.) محاذاة لليمين
 * - جداول أكاديمية بترويسة ملوّنة
 * - صناديق أكواد بخلفية داكنة
 * - تذييل بختم المنصة
 */
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

// ═══════════════════════════════════════════════════════════════
// ثوابت التنسيق والأبعاد
// ═══════════════════════════════════════════════════════════════
const PAGE_MARGIN = 45;
const CONTENT_WIDTH = 595.28 - (PAGE_MARGIN * 2); // A4 width minus margins
const COLORS = {
  primary: '#4f46e5',
  primaryDark: '#3730a3',
  textDark: '#0f172a',
  textBody: '#334155',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  bgLight: '#f8fafc',
  bgAccent: '#eef2ff',
  borderLight: '#e2e8f0',
  borderAccent: '#c7d2fe',
  codeBg: '#0f172a',
  codeText: '#f8fafc',
  white: '#ffffff',
  headerBg: '#e0e7ff',
  headerBorder: '#818cf8',
};

/**
 * يعكس النص العربي بالأحرف لدعم PDFKit (يعمل بدون مكتبة bidi)
 * PDFKit لا يدعم BiDi natively، فنقوم بعكس النص العربي ليظهر صحيحاً مع align: right
 */
function reverseArabicText(text: string): string {
  // اكتشاف إذا النص يحتوي عربي
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  if (!hasArabic) return text;
  
  // عكس النص فقط إذا كان عربياً — PDFKit يرسم الأحرف بترتيب LTR
  // لذلك نحتاج عكسها ليظهر النص العربي بالاتجاه الصحيح
  return text.split('').reverse().join('');
}

/**
 * تنظيف النص من علامات Markdown الـ inline
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1');
}

/**
 * حساب ارتفاع النص المتوقع بناءً على العرض المتاح
 */
function estimateTextHeight(doc: PDFKit.PDFDocument, text: string, fontSize: number, width: number): number {
  doc.fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap: 4 });
}

/**
 * التحقق من وجود مساحة كافية في الصفحة الحالية وإضافة صفحة جديدة إذا لزم الأمر
 */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const pageBottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + needed > pageBottom) {
    doc.addPage();
  }
}

// ═══════════════════════════════════════════════════════════════
// الدالة الرئيسية: تحويل Markdown إلى PDF Buffer
// ═══════════════════════════════════════════════════════════════

/**
 * يحوّل نص Markdown إلى ملف PDF ثنائي (Buffer) جاهز للإرسال
 * 
 * @param title عنوان الملخص / الفيديو
 * @param markdownText نص الملخص بصيغة Markdown
 * @param videoUrl رابط الفيديو المصدر (اختياري)
 * @returns Promise<Buffer> — PDF binary buffer
 */
export async function generatePdfBuffer(
  title: string, 
  markdownText: string, 
  videoUrl?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // ─────────────── تهيئة المستند ───────────────
      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        bufferPages: true,
        info: {
          Title: title,
          Author: 'منصة التمهيد الذكية',
          Subject: 'ملخص دراسي',
          Creator: 'YT Summarizer AI'
        }
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ─────────────── تسجيل الخطوط ───────────────
      // نحدد مسار الخطوط نسبياً من مجلد السيرفر
      const fontsDir = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)), 
        '..', 'assets', 'fonts'
      );
      
      let hasCairoFont = false;
      try {
        doc.registerFont('Cairo', path.join(fontsDir, 'Cairo-Regular.ttf'));
        doc.registerFont('Cairo-Bold', path.join(fontsDir, 'Cairo-Bold.ttf'));
        hasCairoFont = true;
      } catch (fontErr) {
        console.warn('[PDF Generator] Cairo font not found, using Helvetica fallback:', fontErr);
      }

      const fontRegular = hasCairoFont ? 'Cairo' : 'Helvetica';
      const fontBold = hasCairoFont ? 'Cairo-Bold' : 'Helvetica-Bold';

      // ─────────────── ترويسة المستند ───────────────
      // خلفية الترويسة
      doc.save();
      doc.roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, 80, 8)
        .fill(COLORS.headerBg);
      doc.restore();

      // إطار الترويسة
      doc.save();
      doc.roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, 80, 8)
        .lineWidth(1.5)
        .stroke(COLORS.headerBorder);
      doc.restore();

      const headerY = doc.y + 14;

      // شارة "ملخص دراسي شامل"
      doc.font(fontBold).fontSize(8).fillColor(COLORS.primary);
      doc.text('✨ ملخص دراسي شامل', PAGE_MARGIN + 12, headerY, { 
        width: CONTENT_WIDTH - 24, 
        align: 'right' 
      });

      // عنوان الفيديو
      doc.font(fontBold).fontSize(14).fillColor(COLORS.textDark);
      doc.text(title, PAGE_MARGIN + 12, headerY + 18, { 
        width: CONTENT_WIDTH - 24, 
        align: 'right',
        lineGap: 2
      });

      // رابط الفيديو وتاريخ التوليد
      if (videoUrl) {
        doc.font(fontRegular).fontSize(7.5).fillColor(COLORS.textMuted);
        doc.text(`المصدر: ${videoUrl}`, PAGE_MARGIN + 12, headerY + 46, { 
          width: CONTENT_WIDTH - 24, 
          align: 'right'
        });
      }
      
      doc.font(fontRegular).fontSize(7).fillColor(COLORS.textLight);
      doc.text(
        `تاريخ التوليد: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}`, 
        PAGE_MARGIN + 12, headerY + 56, 
        { width: CONTENT_WIDTH - 24, align: 'right' }
      );

      doc.y = headerY + 80;
      doc.moveDown(0.8);

      // خط فاصل بعد الترويسة
      doc.save();
      doc.moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
        .lineWidth(0.5)
        .stroke(COLORS.borderLight);
      doc.restore();
      doc.moveDown(0.6);

      // ─────────────── تحويل محتوى الـ Markdown ───────────────
      const lines = markdownText.split('\n');
      let inCodeBlock = false;
      let codeLines: string[] = [];
      let inTable = false;
      let tableHeaders: string[] = [];
      let tableRows: string[][] = [];

      const flushTable = () => {
        if (!inTable || tableHeaders.length === 0) return;
        
        const colCount = tableHeaders.length;
        const colWidth = (CONTENT_WIDTH - 2) / colCount;
        const tableHeight = 22 + (tableRows.length * 20) + 4;
        ensureSpace(doc, tableHeight);

        const tableX = PAGE_MARGIN + 1;
        let rowY = doc.y;

        // ترويسة الجدول
        doc.save();
        doc.rect(tableX, rowY, CONTENT_WIDTH - 2, 22).fill(COLORS.primaryDark);
        doc.restore();

        doc.font(fontBold).fontSize(8.5).fillColor(COLORS.white);
        for (let c = 0; c < colCount; c++) {
          const cellX = tableX + (c * colWidth);
          doc.text(
            stripInlineMarkdown(tableHeaders[colCount - 1 - c] || ''),
            cellX + 4, rowY + 5,
            { width: colWidth - 8, align: 'right', lineBreak: false }
          );
        }
        rowY += 22;

        // صفوف الجدول
        for (let r = 0; r < tableRows.length; r++) {
          const row = tableRows[r];
          const bgColor = r % 2 === 0 ? COLORS.white : COLORS.bgLight;

          doc.save();
          doc.rect(tableX, rowY, CONTENT_WIDTH - 2, 20).fill(bgColor);
          doc.restore();

          // حد سفلي
          doc.save();
          doc.moveTo(tableX, rowY + 20)
            .lineTo(tableX + CONTENT_WIDTH - 2, rowY + 20)
            .lineWidth(0.3).stroke(COLORS.borderLight);
          doc.restore();

          doc.font(fontRegular).fontSize(8).fillColor(COLORS.textBody);
          for (let c = 0; c < colCount; c++) {
            const cellX = tableX + (c * colWidth);
            doc.text(
              stripInlineMarkdown(row[colCount - 1 - c] || ''),
              cellX + 4, rowY + 5,
              { width: colWidth - 8, align: 'right', lineBreak: false }
            );
          }
          rowY += 20;
        }

        // إطار خارجي
        doc.save();
        doc.rect(tableX, doc.y, CONTENT_WIDTH - 2, rowY - doc.y)
          .lineWidth(0.5).stroke(COLORS.borderLight);
        doc.restore();

        doc.y = rowY + 8;
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      };

      const flushCodeBlock = () => {
        if (!inCodeBlock || codeLines.length === 0) return;
        
        const codeText = codeLines.join('\n');
        const codeHeight = estimateTextHeight(doc, codeText, 8, CONTENT_WIDTH - 28) + 20;
        ensureSpace(doc, codeHeight);

        // خلفية صندوق الكود
        doc.save();
        doc.roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, codeHeight, 6)
          .fill(COLORS.codeBg);
        doc.restore();

        // نص الكود (LTR)
        doc.font('Courier').fontSize(8).fillColor(COLORS.codeText);
        doc.text(codeText, PAGE_MARGIN + 12, doc.y + 10, {
          width: CONTENT_WIDTH - 28,
          align: 'left',
          lineGap: 3
        });

        doc.y = doc.y + 8;
        inCodeBlock = false;
        codeLines = [];
      };

      let listCounter = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // ═══ Code Blocks ═══
        if (trimmed.startsWith('```')) {
          if (inCodeBlock) {
            flushCodeBlock();
          } else {
            flushTable();
            inCodeBlock = true;
            codeLines = [];
          }
          continue;
        }
        if (inCodeBlock) {
          codeLines.push(line);
          continue;
        }

        // ═══ Tables ═══
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
          if (cells.every(c => /^:?-+:?$/.test(c))) continue;
          
          if (!inTable) {
            inTable = true;
            tableHeaders = cells;
            tableRows = [];
          } else {
            tableRows.push(cells);
          }
          continue;
        } else if (inTable) {
          flushTable();
        }

        // ═══ Empty lines ═══
        if (!trimmed) {
          listCounter = 0;
          doc.moveDown(0.3);
          continue;
        }

        // ═══ Headings ═══
        if (trimmed.startsWith('# ')) {
          flushTable();
          const hText = stripInlineMarkdown(trimmed.slice(2));
          const h1Height = estimateTextHeight(doc, hText, 15, CONTENT_WIDTH) + 16;
          ensureSpace(doc, h1Height);

          doc.moveDown(0.5);
          doc.font(fontBold).fontSize(15).fillColor(COLORS.textDark);
          doc.text(hText, PAGE_MARGIN, doc.y, { 
            width: CONTENT_WIDTH, align: 'right', lineGap: 2 
          });
          // خط فاصل تحت H1
          doc.save();
          doc.moveTo(PAGE_MARGIN, doc.y + 3)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y + 3)
            .lineWidth(1.5).stroke(COLORS.primary);
          doc.restore();
          doc.moveDown(0.5);
          listCounter = 0;
          continue;
        }

        if (trimmed.startsWith('## ')) {
          flushTable();
          const hText = stripInlineMarkdown(trimmed.slice(3));
          const h2Height = estimateTextHeight(doc, hText, 12, CONTENT_WIDTH - 20) + 18;
          ensureSpace(doc, h2Height);

          doc.moveDown(0.4);
          // خلفية H2
          doc.save();
          doc.roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, h2Height, 5)
            .fill('#f8faff');
          doc.restore();
          // شريط يمين
          doc.save();
          doc.rect(PAGE_MARGIN + CONTENT_WIDTH - 3, doc.y, 3, h2Height)
            .fill(COLORS.primary);
          doc.restore();

          doc.font(fontBold).fontSize(12).fillColor(COLORS.primaryDark);
          doc.text(hText, PAGE_MARGIN + 8, doc.y + 6, { 
            width: CONTENT_WIDTH - 20, align: 'right', lineGap: 2 
          });
          doc.moveDown(0.3);
          listCounter = 0;
          continue;
        }

        if (trimmed.startsWith('### ')) {
          flushTable();
          const hText = stripInlineMarkdown(trimmed.slice(4));
          ensureSpace(doc, 22);

          doc.moveDown(0.3);
          doc.font(fontBold).fontSize(11).fillColor(COLORS.primary);
          doc.text(`● ${hText}`, PAGE_MARGIN, doc.y, { 
            width: CONTENT_WIDTH, align: 'right', lineGap: 2 
          });
          doc.moveDown(0.2);
          listCounter = 0;
          continue;
        }

        // ═══ Blockquotes ═══
        if (trimmed.startsWith('> ')) {
          flushTable();
          const quoteText = stripInlineMarkdown(trimmed.slice(2));
          const qHeight = estimateTextHeight(doc, quoteText, 10, CONTENT_WIDTH - 24) + 14;
          ensureSpace(doc, qHeight);

          // خلفية الاقتباس
          doc.save();
          doc.roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, qHeight, 4)
            .fill(COLORS.bgAccent);
          doc.restore();
          // شريط يمين
          doc.save();
          doc.rect(PAGE_MARGIN + CONTENT_WIDTH - 3, doc.y, 3, qHeight)
            .fill(COLORS.borderAccent);
          doc.restore();

          doc.font(fontRegular).fontSize(10).fillColor(COLORS.textBody);
          doc.text(quoteText, PAGE_MARGIN + 10, doc.y + 6, { 
            width: CONTENT_WIDTH - 24, align: 'right', lineGap: 3 
          });
          doc.moveDown(0.3);
          continue;
        }

        // ═══ Horizontal rules ═══
        if (/^[-*_]{3,}$/.test(trimmed)) {
          ensureSpace(doc, 12);
          doc.save();
          doc.moveTo(PAGE_MARGIN + 40, doc.y + 4)
            .lineTo(PAGE_MARGIN + CONTENT_WIDTH - 40, doc.y + 4)
            .lineWidth(0.5).stroke(COLORS.borderLight);
          doc.restore();
          doc.moveDown(0.5);
          continue;
        }

        // ═══ Unordered lists ═══
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          flushTable();
          const content = stripInlineMarkdown(trimmed.replace(/^[\-\*•]\s+/, ''));
          const itemHeight = estimateTextHeight(doc, content, 10, CONTENT_WIDTH - 24) + 4;
          ensureSpace(doc, itemHeight);

          // نقطة ملوّنة
          doc.font(fontBold).fontSize(10).fillColor(COLORS.primary);
          doc.text('●', PAGE_MARGIN, doc.y, { 
            width: CONTENT_WIDTH, align: 'right' 
          });
          // محتوى العنصر
          doc.font(fontRegular).fontSize(10).fillColor(COLORS.textBody);
          doc.text(content, PAGE_MARGIN, doc.y - (itemHeight), { 
            width: CONTENT_WIDTH - 16, align: 'right', lineGap: 3 
          });
          doc.moveDown(0.15);
          continue;
        }

        // ═══ Ordered lists ═══
        if (/^\d+\.\s+/.test(trimmed)) {
          flushTable();
          listCounter++;
          const content = stripInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''));
          const itemHeight = estimateTextHeight(doc, content, 10, CONTENT_WIDTH - 24) + 4;
          ensureSpace(doc, itemHeight);

          // رقم ملوّن
          doc.font(fontBold).fontSize(10).fillColor(COLORS.primaryDark);
          doc.text(`${listCounter}.`, PAGE_MARGIN, doc.y, { 
            width: CONTENT_WIDTH, align: 'right' 
          });
          // محتوى العنصر
          doc.font(fontRegular).fontSize(10).fillColor(COLORS.textBody);
          doc.text(content, PAGE_MARGIN, doc.y - (itemHeight), { 
            width: CONTENT_WIDTH - 20, align: 'right', lineGap: 3 
          });
          doc.moveDown(0.15);
          continue;
        }

        // ═══ Paragraphs (نصوص عادية) ═══
        listCounter = 0;
        const paraText = stripInlineMarkdown(trimmed);
        const paraHeight = estimateTextHeight(doc, paraText, 10, CONTENT_WIDTH) + 4;
        ensureSpace(doc, paraHeight);

        doc.font(fontRegular).fontSize(10).fillColor(COLORS.textBody);
        doc.text(paraText, PAGE_MARGIN, doc.y, { 
          width: CONTENT_WIDTH, align: 'right', lineGap: 4 
        });
        doc.moveDown(0.2);
      }

      // Flush remaining
      if (inCodeBlock) flushCodeBlock();
      if (inTable) flushTable();

      // ─────────────── تذييل المستند ───────────────
      ensureSpace(doc, 40);
      doc.moveDown(1);
      doc.save();
      doc.moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
        .lineWidth(0.5).stroke(COLORS.borderLight);
      doc.restore();
      doc.moveDown(0.4);

      doc.font(fontRegular).fontSize(7.5).fillColor(COLORS.textLight);
      doc.text(
        '📚 تم توليد هذا الملخص الدراسي وتنسيقه بواسطة منصة التمهيد الذكية — YT Summarizer AI',
        PAGE_MARGIN, doc.y,
        { width: CONTENT_WIDTH, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
