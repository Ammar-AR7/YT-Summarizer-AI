import { markdownToHtml } from '../../server/helpers/htmlExporter';

/**
 * Escape HTML utility
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Inline formatting helper for Markdown
 */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background-color: #eef2ff; color: #4338ca; border: 1px solid #e0e7ff; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11.5px; word-break: break-all;">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #2563eb; text-decoration: underline; word-break: break-all;">$1</a>');
}

/**
 * Converts Markdown text into high-fidelity Arabic RTL HTML for PDF rendering.
 * Fully responsive structure for mobile viewports and A4 PDF export.
 */
export function convertMarkdownToPdfHtml(markdown: string, title: string, videoUrl?: string): string {
  const lines = markdown.split('\n');
  let html = '';

  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  let inTable = false;
  let tableHeaders: string[] = [];

  let inCodeBlock = false;
  let codeContent: string[] = [];

  const closeList = () => {
    if (inList) {
      html += listType === 'ul' ? '</ul>' : '</ol>';
      inList = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      html += '</tbody></table></div>';
      inTable = false;
      tableHeaders = [];
    }
  };

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      const codeStr = escapeHtml(codeContent.join('\n'));
      html += `
        <div style="margin: 14px 0; background-color: #0b0f19 !important; border: 1px solid #1e293b; color: #f8fafc !important; padding: 14px 16px; border-radius: 8px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11.5px; line-height: 1.65; direction: ltr; text-align: left; overflow: visible; width: 100%; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
          <pre style="margin: 0; white-space: pre-wrap !important; word-break: break-word !important; overflow-wrap: break-word !important; background-color: transparent !important; color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"><code style="background-color: transparent !important; color: #f8fafc !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; white-space: pre-wrap !important; word-break: break-word !important;">${codeStr}</code></pre>
        </div>
      `;
      inCodeBlock = false;
      codeContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
        codeContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Markdown Tables (| header | header |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();

      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());

      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        html += `
          <div style="margin: 16px 0; width: 100%; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; overflow: visible;">
            <table style="width: 100% !important; display: table !important; border-collapse: separate !important; border-spacing: 0 !important; border-radius: 8px !important; overflow: hidden !important; border: 1px solid #cbd5e1 !important; font-family: 'Cairo', sans-serif; font-size: 12px; direction: rtl; text-align: right; table-layout: auto !important;">
              <thead>
                <tr style="background-color: #3730a3 !important; color: #ffffff !important; page-break-inside: avoid; break-inside: avoid; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
        `;
        tableHeaders.forEach((h, idx) => {
          const borderLeft = idx > 0 ? 'border-left: 1px solid #4338ca;' : '';
          html += `<th style="padding: 9px 12px; font-weight: 700; text-align: right; background-color: #3730a3 !important; color: #ffffff !important; word-break: break-word; ${borderLeft}">${formatInline(h)}</th>`;
        });
        html += `
                </tr>
              </thead>
              <tbody>
        `;
      } else {
        const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        html += `<tr style="background-color: ${rowBg} !important; page-break-inside: avoid; break-inside: avoid; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">`;
        cells.forEach((c, idx) => {
          const borderLeft = idx > 0 ? 'border-left: 1px solid #f1f5f9;' : '';
          html += `<td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; line-height: 1.55; text-align: right; word-break: break-word; ${borderLeft}">${formatInline(c)}</td>`;
        });
        html += `</tr>`;
      }
      continue;
    }

    // Unordered lists (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      closeTable();
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        html += `<ul style="margin: 8px 0; padding-right: 22px; list-style-type: disc; color: #334155; line-height: 1.75; font-size: 13px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">`;
      }
      const content = trimmed.replace(/^[\-\*]\s+/, '');
      html += `<li style="margin-bottom: 5px; text-align: right; page-break-inside: avoid; break-inside: avoid;">${formatInline(content)}</li>`;
      continue;
    }

    // Ordered lists (1. 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      closeTable();
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        html += `<ol style="margin: 8px 0; padding-right: 22px; list-style-type: decimal; color: #334155; line-height: 1.75; font-size: 13px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">`;
      }
      const content = trimmed.replace(/^\d+\.\s+/, '');
      html += `<li style="margin-bottom: 5px; text-align: right; page-break-inside: avoid; break-inside: avoid;">${formatInline(content)}</li>`;
      continue;
    }

    if (inList) {
      closeList();
    }

    // Headings #, ##, ###
    if (trimmed.startsWith('# ')) {
      closeTable();
      const hText = trimmed.replace(/^#\s+/, '');
      html += `<h1 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin-top: 22px; margin-bottom: 10px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h1>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeTable();
      const hText = trimmed.replace(/^##\s+/, '');
      html += `<h2 style="font-size: 14.5px; font-weight: 700; color: #312e81 !important; background-color: #f8faff !important; border-right: 4px solid #4f46e5 !important; border: 1px solid #e0e7ff; border-right-width: 4px; padding: 8px 12px; border-radius: 8px; margin-top: 18px; margin-bottom: 10px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${formatInline(hText)}</h2>`;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeTable();
      const hText = trimmed.replace(/^###\s+/, '');
      html += `<h3 style="font-size: 13.5px; font-weight: 700; color: #4338ca; margin-top: 14px; margin-bottom: 6px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">● ${formatInline(hText)}</h3>`;
      continue;
    }

    // Blockquote >
    if (trimmed.startsWith('>')) {
      closeTable();
      const quoteText = trimmed.replace(/^>\s*/, '');
      html += `<blockquote style="margin: 12px 0; padding: 10px 14px; background-color: #f8fafc !important; border-right: 4px solid #6366f1 !important; border: 1px solid #e2e8f0; border-right-width: 4px; color: #334155; font-size: 13px; line-height: 1.75; border-radius: 8px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">${formatInline(quoteText)}</blockquote>`;
      continue;
    }

    // Horizontal rule ---
    if (/^(\-\-\-|\*\*\*|___)$/.test(trimmed)) {
      closeTable();
      html += `<hr style="border: 0; height: 1px; background-color: #e2e8f0; margin: 16px 0;" />`;
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    // Regular paragraph
    html += `<p style="margin: 6px 0; line-height: 1.75; color: #334155; font-size: 13px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid; word-break: break-word; overflow-wrap: break-word;">${formatInline(trimmed)}</p>`;
  }

  closeTable();
  closeList();
  closeCodeBlock();

  const formattedDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const headerHtml = `
    <div style="margin-bottom: 18px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">
      <!-- Accent Top Gradient Bar -->
      <div style="height: 5px; background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%) !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-radius: 4px; margin-bottom: 14px;"></div>
      
      <!-- Meta Badges -->
      <table style="width: 100% !important; border-collapse: collapse; margin-bottom: 10px; border: none; display: table !important;">
        <tr>
          <td style="text-align: right; border: none; padding: 0;">
            <span style="background-color: #eef2ff !important; color: #4338ca !important; border: 1px solid #c7d2fe; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 11px; display: inline-block; font-family: 'Cairo', sans-serif;">✨ ملخص دراسي شامل</span>
          </td>
          <td style="text-align: left; border: none; padding: 0; direction: ltr;">
            <span style="background-color: #f8fafc !important; color: #64748b !important; border: 1px solid #e2e8f0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 4px 12px; border-radius: 16px; font-size: 10.5px; display: inline-block;">📅 ${formattedDate}</span>
          </td>
        </tr>
      </table>

      <!-- Main Document Title -->
      <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 10px 0 8px 0; line-height: 1.45; text-align: right; font-family: 'Cairo', sans-serif; word-break: break-word;">${escapeHtml(title)}</h1>
      
      <!-- Source Video Link -->
      ${videoUrl ? `
        <div style="margin-top: 8px; background-color: #eff6ff !important; border: 1px solid #bfdbfe; padding: 5px 12px; border-radius: 8px; font-size: 11px; color: #1e40af !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; direction: ltr; text-align: left; display: inline-block; word-break: break-all;">
          <strong>🎥 المقطع:</strong> <a href="${escapeHtml(videoUrl)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${escapeHtml(videoUrl)}</a>
        </div>
      ` : ''}

      <!-- Header Divider -->
      <div style="border-bottom: 1px solid #e2e8f0; margin-top: 14px; width: 100%;"></div>
    </div>
  `;

  const footerHtml = `
    <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; direction: rtl; page-break-inside: avoid; break-inside: avoid; font-family: 'Cairo', sans-serif;">
      تم إنشاؤه وتنسيقه بواسطة <strong>مساعد تلخيص يوتيوب الذكي</strong> • جميع الحقوق محفوظة © ${new Date().getFullYear()}
    </div>
  `;

  return `
    <div style="width: 100%; max-width: 100%; background-color: #ffffff; margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl; text-align: right; line-height: 1.75; word-wrap: break-word; overflow-wrap: break-word;">
      ${headerHtml}
      <div style="font-size: 13px; color: #334155; width: 100%; max-width: 100%; box-sizing: border-box;">
        ${html}
      </div>
      ${footerHtml}
    </div>
  `;
}

/**
 * كشف هل المستخدم على جوال
 */
function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 768);
}

/**
 * Downloads document directly as a high-precision PDF file to Downloads folder.
 */
export async function downloadAsPdf(title: string, markdownText: string, videoUrl?: string): Promise<void> {
  if (isMobileDevice()) {
    await downloadPdfOnMobile(title, markdownText, videoUrl);
  } else {
    printSummary(title, markdownText, videoUrl);
  }
}

/**
 * توليد وتحميل ملف PDF مباشر على الجوال:
 * 
 * الحل يعتمد على فصل المعاينة عن الالتقاط:
 * 1. المستخدم يشوف overlay تحميل (لا يحتاج يشوف المحتوى)
 * 2. عنصر الـ render يكون خلف الـ overlay مباشرة على body بعرض A4 كامل (794px)
 *    بدون أي parent يقصّه (overflow: hidden كان يقص المحتوى قبل transform)
 * 3. html2canvas يلتقط العنصر بعرضه الكامل → PDF مضبوط
 */
async function downloadPdfOnMobile(title: string, markdownText: string, videoUrl?: string): Promise<void> {
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {}

  const htmlContent = convertMarkdownToPdfHtml(markdownText, title, videoUrl);

  // أبعاد A4 بالبكسل عند 96 DPI: العرض ≈ 794px
  const A4_WIDTH_PX = 794;

  // ═══════════════════════════════════════════════════════════════
  // 1. Overlay تحميل مرئي للمستخدم (يغطي الشاشة بالكامل)
  // ═══════════════════════════════════════════════════════════════
  const overlay = document.createElement('div');
  overlay.id = 'pdf-mobile-loading-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; direction: rtl;';
  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 20px; padding: 32px 28px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.25); max-width: 300px; width: 85%; font-family: 'Cairo', sans-serif;">
      <div style="width: 52px; height: 52px; border: 4px solid #e0e7ff; border-top-color: #4f46e5; border-radius: 50%; animation: pdfSpin 0.8s linear infinite; margin: 0 auto 18px;"></div>
      <div style="font-size: 16px; font-weight: 800; color: #1e1b4b; margin-bottom: 8px; line-height: 1.5;">جاري توليد ملف الـ PDF 📄</div>
      <div style="font-size: 12.5px; color: #64748b; line-height: 1.6;">يتم تنسيق المستند بأبعاد A4 القياسية...<br>يرجى الانتظار لحظات</div>
    </div>
    <style>@keyframes pdfSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(overlay);

  // ═══════════════════════════════════════════════════════════════
  // 2. عنصر الـ Render (خلف الـ overlay، بعرض A4 كامل)
  //    - مباشرة على body بدون أي parent يقص المحتوى
  //    - position: fixed + left: 0 عشان يبقى في الـ DOM ويقدر html2canvas يلتقطه
  //    - z-index أقل من الـ overlay عشان المستخدم ما يشوفه
  // ═══════════════════════════════════════════════════════════════
  const renderContainer = document.createElement('div');
  renderContainer.id = 'pdf-a4-render-container';
  renderContainer.style.cssText = `position: fixed; top: 0; left: 0; width: ${A4_WIDTH_PX}px; z-index: 999998; background: #ffffff; overflow: visible;`;
  renderContainer.innerHTML = `
    <div id="mobile-pdf-render-target" style="width: ${A4_WIDTH_PX}px; max-width: ${A4_WIDTH_PX}px; background-color: #ffffff; padding: 28px 32px; box-sizing: border-box; font-family: 'Cairo', system-ui, sans-serif; color: #0f172a; direction: rtl; text-align: right; word-break: break-word; overflow-wrap: break-word;">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        #mobile-pdf-render-target *, #mobile-pdf-render-target *:before, #mobile-pdf-render-target *:after {
          font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        div[style*="background-color: #0b0f19"], div[style*="background-color:#0b0f19"], pre, code {
          background-color: #0b0f19 !important;
          color: #f8fafc !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          white-space: pre-wrap !important;
          word-break: break-word !important;
        }
        p, li, tr, blockquote, div, h1, h2, h3 {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      </style>
      ${htmlContent}
    </div>
  `;

  // نحفظ overflow الحالي ونفتحه عشان ما يتقص المحتوى بأي شكل
  const savedBodyOverflow = document.body.style.overflow;
  const savedHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'visible';
  document.documentElement.style.overflow = 'visible';
  document.body.appendChild(renderContainer);

  // ننتظر عشان الخطوط تتحمل والمحتوى ينرسم بالكامل
  await new Promise(resolve => setTimeout(resolve, 800));

  const targetEl = document.getElementById('mobile-pdf-render-target');
  if (!targetEl) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    if (document.body.contains(renderContainer)) document.body.removeChild(renderContainer);
    return;
  }

  try {
    void targetEl.offsetHeight;

    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default;
    const cleanTitle = title.replace(/[^\w\s\u0600-\u06FF]/gi, '_').replace(/\s+/g, '_').substring(0, 40) || 'ملخص_دراسي';

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `${cleanTitle}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: ['tr', 'blockquote', 'table', 'pre', 'code', 'div', 'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li']
      },
      html2canvas: {
        scale: 2,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    await html2pdf().set(opt as any).from(targetEl).save();
  } catch (err) {
    console.error('[PDF Mobile Direct Save Failed]:', err);
    openPrintableWindow(title, markdownText, videoUrl);
  } finally {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    if (document.body.contains(renderContainer)) document.body.removeChild(renderContainer);
  }
}

/**
 * فتح المستند المنسق كصفحة مستقلة مخصصة للجوال والطباعة
 */
export function openPrintableWindow(title: string, markdownText: string, videoUrl?: string): void {
  const innerHtml = convertMarkdownToPdfHtml(markdownText, title, videoUrl);
  const fullDocumentHtml = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
      <title>${escapeHtml(title)} - مستند PDF</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 14mm 14mm 14mm;
        }
        *, *::before, *::after {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }
        html, body {
          margin: 0;
          padding: 12px;
          background: #f1f5f9;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          color: #0f172a;
          direction: rtl;
        }
        .actions-card {
          max-width: 800px;
          margin: 0 auto 16px auto;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.12);
          border: 1px solid #e0e7ff;
          text-align: center;
        }
        .actions-title {
          font-size: 14px;
          font-weight: 800;
          color: #1e1b4b;
          margin-bottom: 8px;
        }
        .actions-desc {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 14px;
        }
        .buttons-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btn {
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-family: 'Cairo', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .btn-print { background: #4f46e5; color: #ffffff; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
        .btn-close { background: #f1f5f9; color: #475569; }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
          padding: 28px 32px;
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          box-sizing: border-box;
        }
        @media print {
          .actions-card { display: none !important; }
          html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .container { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; border-radius: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="actions-card">
        <div class="actions-title">✨ مستند الملخص جاهز للتصدير والطباعة</div>
        <div class="actions-desc">معاينة المستند وحفظه بتنسيق PDF على جهازك:</div>
        <div class="buttons-row">
          <button onclick="window.print()" class="btn btn-print">📄 حفظ / طباعة كـ PDF</button>
          <button onclick="window.close()" class="btn btn-close">إغلاق النافذة ×</button>
        </div>
      </div>
      <div class="container">
        ${innerHtml}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([fullDocumentHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    window.location.href = url;
  }
}

/**
 * Native Browser Print & Save-to-PDF function for Desktop.
 * 
 * - Eliminates scrollbars, page bars, and clipping artifacts
 * - Injects clean print styles specifically for A4 portrait
 * - Automatically cleans up temporary DOM nodes after print
 */
export function printSummary(title: string, markdownText: string, videoUrl?: string): void {
  const htmlContent = convertMarkdownToPdfHtml(markdownText, title, videoUrl);

  const existingRoot = document.getElementById('printable-pdf-root');
  if (existingRoot && document.body.contains(existingRoot)) {
    document.body.removeChild(existingRoot);
  }
  const existingStyle = document.getElementById('printable-pdf-styles');
  if (existingStyle && document.head.contains(existingStyle)) {
    document.head.removeChild(existingStyle);
  }

  const styleEl = document.createElement('style');
  styleEl.id = 'printable-pdf-styles';
  styleEl.innerHTML = `
    @media print {
      @page {
        size: A4 portrait;
        margin: 14mm 14mm 14mm 14mm;
      }
      
      *, *::before, *::after {
        box-sizing: border-box !important;
        max-width: 100% !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      html, body {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: 'Cairo', system-ui, sans-serif !important;
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        scrollbar-width: none !important;
      }

      /* Hide the entire web app and leave only the printable root */
      body > *:not(#printable-pdf-root) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }

      #printable-pdf-root {
        display: block !important;
        visibility: visible !important;
        position: relative !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        direction: rtl !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      div[style*="background-color: #0b0f19"], div[style*="background-color:#0b0f19"], pre, code {
        background-color: #0b0f19 !important;
        color: #f8fafc !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }

      p, li, tr, blockquote, div, h1, h2, h3 {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      table {
        width: 100% !important;
        max-width: 100% !important;
        display: table !important;
        table-layout: auto !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        overflow: visible !important;
      }

      th, td {
        word-break: break-word !important;
        overflow-wrap: break-word !important;
      }

      pre, code {
        white-space: pre-wrap !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        max-width: 100% !important;
        overflow: visible !important;
      }
    }

    @media screen {
      #printable-pdf-root {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  const printRoot = document.createElement('div');
  printRoot.id = 'printable-pdf-root';
  printRoot.innerHTML = htmlContent;
  document.body.appendChild(printRoot);

  const triggerPrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Window print failed, opening printable window:', e);
      openPrintableWindow(title, markdownText, videoUrl);
    }
  };

  if (document.readyState === 'complete') {
    triggerPrint();
  } else {
    window.addEventListener('load', triggerPrint, { once: true });
  }
}
