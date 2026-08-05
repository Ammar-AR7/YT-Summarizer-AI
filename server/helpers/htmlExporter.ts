/**
 * HTML Exporter — توليد محتوى HTML لتصدير Word و PDF
 * 
 * يحوّل Markdown إلى HTML منسّق بأنماط RTL عربية
 * مع جداول ملوّنة وعناوين منسقة.
 */

/**
 * يحوّل صفوف الجدول إلى HTML table منسّق
 */
export function flushTable(rows: string[][], width: number): string {
  if (rows.length === 0) return '';
  let html = '<table style="width: 100%; border-collapse: collapse; margin: 18px 0; direction: rtl; text-align: right; border: 1px solid #cbd5e1; font-family: Arial, sans-serif; table-layout: fixed; word-wrap: break-word; overflow-wrap: break-word;">';
  const headerRow = rows[0];
  html += '<thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #94a3b8;">';
  for (let i = 0; i < width; i++) {
    html += `<th style="padding: 10px 14px; text-align: right; font-weight: bold; color: #1e1b4b; font-size: 11pt; border: 1px solid #cbd5e1; word-wrap: break-word; overflow-wrap: break-word;">${headerRow[i] || ''}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const bgColor = r % 2 === 0 ? '#f8fafc' : '#ffffff';
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e2e8f0;">`;
    for (let c = 0; c < width; c++) {
      html += `<td style="padding: 8px 14px; text-align: right; color: #334155; font-size: 10pt; border: 1px solid #cbd5e1; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word;">${row[c] || ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

/**
 * يحوّل Markdown إلى HTML منسّق للتصدير
 */
export function markdownToHtml(summaryText: string): string {
  const lines = summaryText.split('\n');
  let htmlContent = '';
  let inTable = false;
  let tableRows: string[][] = [];
  let tableWidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table parsing
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells[cells.length - 1] === '') cells.pop();

      const isSeparator = cells.every(cell => /^[:-]+$/.test(cell));
      if (isSeparator) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(cells);
      if (cells.length > tableWidth) {
        tableWidth = cells.length;
      }
      continue;
    } else if (inTable) {
      htmlContent += flushTable(tableRows, tableWidth);
      inTable = false;
      tableRows = [];
      tableWidth = 0;
    }

    if (!trimmed) {
      htmlContent += '<br/>';
      continue;
    }

    if (trimmed.startsWith('# ')) {
      htmlContent += `<h1 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:20pt; margin-top:16pt; margin-bottom:8pt; border-bottom:1px solid #e5e7eb; padding-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(2)}</h1>`;
    } else if (trimmed.startsWith('## ')) {
      htmlContent += `<h2 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:16pt; margin-top:14pt; margin-bottom:6pt; direction:rtl; text-align:right;">${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith('### ')) {
      htmlContent += `<h3 style="color:#111827; font-family:Arial, sans-serif; font-size:12pt; margin-top:12pt; margin-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(4)}</h3>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      htmlContent += `<li style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; margin-bottom:4pt; direction:rtl; text-align:right; list-style-type:square;">${trimmed.slice(2)}</li>`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '');
      const num = trimmed.match(/^\d+/)?.[0] || '1';
      htmlContent += `<li style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; margin-bottom:4pt; direction:rtl; text-align:right;">${num}. ${content}</li>`;
    } else {
      htmlContent += `<p style="font-family:Arial, sans-serif; font-size:11pt; color:#374151; line-height:1.6; direction:rtl; text-align:right; margin-bottom:8pt;">${trimmed}</p>`;
    }
  }

  // Flush any remaining table
  if (inTable && tableRows.length > 0) {
    htmlContent += flushTable(tableRows, tableWidth);
  }

  // Apply inline formatting (bold, code)
  htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#4f46e5; font-weight:bold; background-color:#f5f3ff; padding:2px 4px; border-radius:4px;">$1</strong>');
  htmlContent = htmlContent.replace(/`(.*?)`/g, '<code style="font-family:Consolas, monospace; font-size:10pt; background-color:#f3f4f6; color:#4f46e5; padding:2px 4px; border-radius:4px;">$1</code>');

  return htmlContent;
}

/**
 * يولّد مستند Word HTML كامل
 */
export function generateWordDocument(title: string, htmlContent: string, videoUrl: string): string {
  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 1in;
          direction: rtl;
          text-align: right;
          background-color: #ffffff;
        }
      </style>
    </head>
    <body>
      <div style="background-color:#e0e7ff; border:2px solid #818cf8; padding:15px; margin-bottom:20px; border-radius:8px; direction:rtl; text-align:right;">
        <h1 style="color:#4f46e5; font-family:Arial, sans-serif; font-size:22pt; margin:0 0 5px 0;">${title}</h1>
        ${videoUrl ? `<p style="color:#4b5563; font-family:Arial, sans-serif; font-size:10pt; margin:0 0 5px 0;">رابط الفيديو الأصلي: <a href="${videoUrl}" style="color:#4f46e5;">${videoUrl}</a></p>` : ''}
        <p style="color:#9ca3af; font-family:Arial, sans-serif; font-size:9pt; margin:0;">تم توليد هذا الملخص الدراسي مهيكلاً ومنسقاً بالألوان بواسطة منصة التمهيد الذكية</p>
      </div>
      <div style="direction:rtl; text-align:right;">
        ${htmlContent}
      </div>
    </body>
    </html>
  `;
}

/**
 * يولّد صفحة PDF HTML كاملة (تفتح الطباعة تلقائياً)
 */
export function generatePdfDocument(title: string, htmlContent: string, videoUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <style>
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          pre, code, div[style*="background-color: #0f172a"], div[style*="background-color:#0f172a"] {
            background-color: #0f172a !important;
            color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        * {
          box-sizing: border-box;
          max-width: 100%;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          width: 100%;
          direction: rtl;
          text-align: right;
          background-color: #ffffff;
          color: #334155;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        h1, h2, h3, p, li, td, th, div, span, code, strong {
          word-wrap: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
        table {
          table-layout: fixed;
          width: 100%;
          border-collapse: collapse;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        td, th {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        pre, code {
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
      </style>
    </head>
    <body onload="window.print();">
      <div style="width: 100%; max-width: 100%; box-sizing: border-box; padding: 0; margin: 0;">
        <div style="background-color:#e0e7ff; border:2px solid #818cf8; padding:20px; margin-bottom:30px; border-radius:12px; word-wrap:break-word;">
          <h1 style="color:#4f46e5; font-size:24px; margin:0 0 10px 0; word-wrap:break-word;">${title}</h1>
          ${videoUrl ? `<p style="color:#4b5563; font-size:12px; margin:0 0 5px 0; word-wrap:break-word;">رابط الفيديو الأصلي: <a href="${videoUrl}" style="color:#4f46e5; text-decoration:none;">${videoUrl}</a></p>` : ''}
          <p style="color:#64748b; font-size:11px; margin:0;">تاريخ التوليد: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        <div style="width: 100%; max-width: 100%;">
          ${htmlContent}
        </div>
      </div>
    </body>
    </html>
  `;
}
