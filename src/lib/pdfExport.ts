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
    .replace(/`(.*?)`/g, '<code style="background-color: #f1f5f9; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #2563eb; text-decoration: underline;">$1</a>');
}

/**
 * Converts Markdown text into high-fidelity Arabic RTL HTML for PDF rendering.
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
        <div style="margin: 16px 0; background-color: #0f172a; color: #f8fafc; padding: 14px 18px; border-radius: 8px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; line-height: 1.6; direction: ltr; text-align: left; overflow-x: auto; page-break-inside: avoid; break-inside: avoid;">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;"><code>${codeStr}</code></pre>
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
          <div style="margin: 18px 0; overflow-x: auto; width: 100%; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid;">
            <table style="width: 100%; border-collapse: collapse; direction: rtl; text-align: right; border: 1px solid #cbd5e1; font-family: 'Cairo', sans-serif; font-size: 13px;">
              <thead>
                <tr style="background-color: #4f46e5; color: #ffffff;">
        `;
        tableHeaders.forEach((h) => {
          html += `<th style="padding: 10px 14px; border: 1px solid #6366f1; font-weight: 700; text-align: right;">${formatInline(h)}</th>`;
        });
        html += `
                </tr>
              </thead>
              <tbody>
        `;
      } else {
        const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        html += `<tr style="background-color: ${rowBg};">`;
        cells.forEach((c) => {
          html += `<td style="padding: 9px 14px; border: 1px solid #e2e8f0; color: #334155; line-height: 1.6; text-align: right;">${formatInline(c)}</td>`;
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
        html += `<ul style="margin: 10px 0; padding-right: 22px; list-style-type: disc; color: #334155; line-height: 1.8; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">`;
      }
      const content = trimmed.replace(/^[\-\*]\s+/, '');
      html += `<li style="margin-bottom: 6px; text-align: right;">${formatInline(content)}</li>`;
      continue;
    }

    // Ordered lists (1. 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      closeTable();
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        html += `<ol style="margin: 10px 0; padding-right: 22px; list-style-type: decimal; color: #334155; line-height: 1.8; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">`;
      }
      const content = trimmed.replace(/^\d+\.\s+/, '');
      html += `<li style="margin-bottom: 6px; text-align: right;">${formatInline(content)}</li>`;
      continue;
    }

    if (inList) {
      closeList();
    }

    // Headings #, ##, ###
    if (trimmed.startsWith('# ')) {
      closeTable();
      const hText = trimmed.replace(/^#\s+/, '');
      html += `<h1 style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h1>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeTable();
      const hText = trimmed.replace(/^##\s+/, '');
      html += `<h2 style="font-size: 16px; font-weight: 700; color: #312e81; background-color: #f5f3ff; border-right: 5px solid #4f46e5; padding: 8px 14px; border-radius: 6px; margin-top: 20px; margin-bottom: 12px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h2>`;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      closeTable();
      const hText = trimmed.replace(/^###\s+/, '');
      html += `<h3 style="font-size: 14px; font-weight: 700; color: #4338ca; margin-top: 16px; margin-bottom: 8px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h3>`;
      continue;
    }

    // Blockquote >
    if (trimmed.startsWith('>')) {
      closeTable();
      const quoteText = trimmed.replace(/^>\s*/, '');
      html += `<blockquote style="margin: 14px 0; padding: 12px 16px; background-color: #f8fafc; border-right: 4px solid #6366f1; color: #334155; font-size: 13.5px; line-height: 1.8; border-radius: 6px; direction: rtl; text-align: right; page-break-inside: avoid; break-inside: avoid;">${formatInline(quoteText)}</blockquote>`;
      continue;
    }

    // Horizontal rule ---
    if (/^(\-\-\-|\*\*\*|___)$/.test(trimmed)) {
      closeTable();
      html += `<hr style="border: 0; height: 1px; background-color: #cbd5e1; margin: 20px 0;" />`;
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    // Regular paragraph
    html += `<p style="margin: 8px 0; line-height: 1.8; color: #1e293b; font-size: 13.5px; direction: rtl; text-align: right;">${formatInline(trimmed)}</p>`;
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
    <div style="margin-bottom: 24px; direction: rtl; text-align: right;">
      <div style="height: 5px; background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%); border-radius: 4px; margin-bottom: 16px;"></div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: none;">
        <tr>
          <td style="text-align: right; border: none; padding: 0;">
            <span style="background-color: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 16px; font-weight: 700; font-size: 12px; display: inline-block; font-family: 'Cairo', sans-serif;">✨ ملخص دراسي شامل</span>
          </td>
          <td style="text-align: left; border: none; padding: 0; direction: ltr;">
            <span style="background-color: #f1f5f9; color: #64748b; padding: 4px 12px; border-radius: 16px; font-size: 11px; display: inline-block;">📅 ${formattedDate}</span>
          </td>
        </tr>
      </table>

      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 12px 0 10px 0; line-height: 1.4; text-align: right; font-family: 'Cairo', sans-serif;">${escapeHtml(title)}</h1>
      
      ${videoUrl ? `
        <div style="margin-top: 8px; background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-size: 11.5px; color: #1e40af; direction: ltr; text-align: left; display: inline-block;">
          <strong>🎥 المقطع:</strong> <a href="${escapeHtml(videoUrl)}" target="_blank" style="color: #2563eb; text-decoration: underline;">${escapeHtml(videoUrl)}</a>
        </div>
      ` : ''}

      <div style="border-bottom: 1px solid #e2e8f0; margin-top: 16px; width: 100%;"></div>
    </div>
  `;

  const footerHtml = `
    <div style="margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; direction: rtl; page-break-inside: avoid; break-inside: avoid; font-family: 'Cairo', sans-serif;">
      تم إنشاؤه وتنسيقه بواسطة <strong>مساعد تلخيص يوتيوب الذكي</strong> • جميع الحقوق محفوظة © ${new Date().getFullYear()}
    </div>
  `;

  return `
    <div style="width: 100%; max-width: 100%; background-color: #ffffff; margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl; text-align: right; line-height: 1.8; word-wrap: break-word; overflow-wrap: break-word;">
      ${headerHtml}
      <div style="font-size: 13.5px; color: #1e293b; width: 100%; max-width: 100%; box-sizing: border-box;">
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
 * Downloads document directly as a high-precision PDF.
 */
export async function downloadAsPdf(title: string, markdownText: string, videoUrl?: string): Promise<void> {
  if (isMobileDevice()) {
    // فتح نافذة المستند التفاعلي الجاهز للحفظ والطباعة المباشرة من الجوال 100% دون أي صفحات بيضاء
    openPrintableWindow(title, markdownText, videoUrl);
  } else {
    printSummary(title, markdownText, videoUrl);
  }
}

/**
 * فتح المستند المنسق كصفحة مستقلة مخصصة للجوال للطباعة والحفظ الفوري كـ PDF
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
        body {
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
          padding: 24px;
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          box-sizing: border-box;
        }
        @media print {
          .actions-card { display: none !important; }
          body { background: #fff !important; padding: 0 !important; }
          .container { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; border-radius: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="actions-card">
        <div class="actions-title">✨ مستند الملخص جاهز للتصدير والتنزيل</div>
        <div class="actions-desc">اضغط على الزر أدناه لحفظ المستند كملف PDF عالي الجودة على هاتفك:</div>
        <div class="buttons-row">
          <button onclick="window.print()" class="btn btn-print">📄 حفظ / طباعة كـ PDF</button>
          <button onclick="window.close()" class="btn btn-close">إغلاق النافذة ×</button>
        </div>
      </div>
      <div class="container">
        ${innerHtml}
      </div>
      <script>
        // Auto trigger print menu on mobile window load
        window.addEventListener('load', function() {
          setTimeout(function() {
            try { window.print(); } catch(e) {}
          }, 600);
        });
      </script>
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
        margin: 15mm 15mm 15mm 15mm;
      }
      *, *:before, *:after {
        box-sizing: border-box !important;
        max-width: 100% !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: 'Cairo', system-ui, sans-serif !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#printable-pdf-root) {
        display: none !important;
      }
      #printable-pdf-root {
        display: block !important;
        position: relative !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        direction: rtl !important;
        box-sizing: border-box !important;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      th, td {
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
      pre, code {
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        max-width: 100% !important;
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
