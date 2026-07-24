/**
 * Utility to generate and download a beautifully formatted Word (.doc) document
 * from structured markdown text with custom colors, RTL layout, code block comments, and headers.
 */
function flushTableToHtmlWord(rows: string[][], width: number): string {
  if (rows.length === 0) return '';
  
  let html = '<table style="width: 100%; border-collapse: collapse; margin: 18px 0; direction: rtl; text-align: right; border: 1px solid #cbd5e1; font-family: \'Segoe UI\', \'Traditional Arabic\', Arial, sans-serif;">';
  
  // Headers
  const headerRow = rows[0];
  html += '<thead><tr style="background-color: #f1f5f9; border-bottom: 2px solid #6366f1;">';
  for (let i = 0; i < width; i++) {
    const text = headerRow[i] || '';
    html += `<th style="padding: 10px 14px; text-align: right; font-weight: bold; color: #1e1b4b; font-size: 11pt; border: 1px solid #cbd5e1;">${text}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Body rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const bgColor = r % 2 === 0 ? '#f8fafc' : '#ffffff';
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e2e8f0;">`;
    for (let c = 0; c < width; c++) {
      const text = row[c] || '';
      html += `<td style="padding: 8px 14px; text-align: right; color: #334155; font-size: 10pt; border: 1px solid #cbd5e1; line-height: 1.5;">${text}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

function formatCodeLineWithArabicComments(line: string): string {
  const escaped = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const hasArabic = /[\u0600-\u06FF]/.test(escaped);
  if (!hasArabic) {
    return escaped;
  }

  const commentMatch = escaped.match(/(\/\/|#|--|\/\*)/);
  if (commentMatch && commentMatch.index !== undefined) {
    const idx = commentMatch.index;
    const codePart = escaped.slice(0, idx);
    const commentPart = escaped.slice(idx);
    
    if (/[\u0600-\u06FF]/.test(commentPart)) {
      return `${codePart}<span dir="rtl" style="direction: rtl; unicode-bidi: embed; color: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif;">${commentPart}</span>`;
    }
  }

  return `<span dir="rtl" style="direction: rtl; unicode-bidi: embed; color: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif;">${escaped}</span>`;
}

export function downloadAsWord(title: string, summaryText: string, videoUrl?: string) {
  const lines = summaryText.split('\n');
  let htmlContent = '';
  
  let inTable = false;
  let tableRows: string[][] = [];
  let tableWidth = 0;

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code blocks (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        const formattedCodeLines = codeBlockLines.map(l => formatCodeLineWithArabicComments(l)).join('\n');
        htmlContent += `<table style="width: 100%; border-collapse: collapse; margin: 14px 0; background-color: #0f172a; border: 1px solid #1e293b; direction: ltr; text-align: left;">
          <tr>
            <td style="padding: 12px 16px; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; direction: ltr; text-align: left;">
              ${codeLang ? `<div style="color: #94a3b8; font-size: 8pt; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">${codeLang}</div>` : ''}
              <pre style="margin: 0; padding: 0; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; white-space: pre-wrap; word-break: break-all; direction: ltr; text-align: left;"><code>${formattedCodeLines}</code></pre>
            </td>
          </tr>
        </table>`;
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Parse tables
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
      htmlContent += flushTableToHtmlWord(tableRows, tableWidth);
      inTable = false;
      tableRows = [];
      tableWidth = 0;
    }

    if (!trimmed) {
      htmlContent += '<br/>';
      continue;
    }
    
    // Header 1
    if (trimmed.startsWith('# ')) {
      htmlContent += `<h1 style="color:#1e1b4b; font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:20pt; margin-top:20pt; margin-bottom:8pt; border-bottom:2px solid #6366f1; padding-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(2)}</h1>`;
    }
    // Header 2
    else if (trimmed.startsWith('## ')) {
      htmlContent += `<h2 style="color:#3730a3; font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:15pt; margin-top:16pt; margin-bottom:6pt; border-bottom:1px solid #e2e8f0; padding-bottom:3pt; direction:rtl; text-align:right;">${trimmed.slice(3)}</h2>`;
    }
    // Header 3
    else if (trimmed.startsWith('### ')) {
      htmlContent += `<h3 style="color:#1e293b; font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:12pt; margin-top:12pt; margin-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(4)}</h3>`;
    }
    // Bullet list items
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      htmlContent += `<li style="font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:11pt; color:#334155; margin-bottom:4pt; direction:rtl; text-align:right; list-style-type:square;">${trimmed.slice(2)}</li>`;
    }
    // Numbered list items
    else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '');
      const num = trimmed.match(/^\d+/)?.[0] || '1';
      htmlContent += `<li style="font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:11pt; color:#334155; margin-bottom:4pt; direction:rtl; text-align:right;">${num}. ${content}</li>`;
    }
    // Normal paragraph
    else {
      htmlContent += `<p style="font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:11pt; color:#334155; line-height:1.7; direction:rtl; text-align:right; margin-bottom:8pt;">${trimmed}</p>`;
    }
  }

  // Handle unclosed table
  if (inTable && tableRows.length > 0) {
    htmlContent += flushTableToHtmlWord(tableRows, tableWidth);
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    const formattedCodeLines = codeBlockLines.map(l => formatCodeLineWithArabicComments(l)).join('\n');
    htmlContent += `<table style="width: 100%; border-collapse: collapse; margin: 14px 0; background-color: #0f172a; border: 1px solid #1e293b; direction: ltr; text-align: left;">
      <tr>
        <td style="padding: 12px 16px; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; direction: ltr; text-align: left;">
          <pre style="margin: 0; padding: 0; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; white-space: pre-wrap; word-break: break-all; direction: ltr; text-align: left;"><code>${formattedCodeLines}</code></pre>
        </td>
      </tr>
    </table>`;
  }

  // Apply inline bold formatting **bold** -> strong (with a beautiful highlight)
  htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#4f46e5; font-weight:bold; background-color:#f5f3ff; padding:2px 4px; border-radius:4px;">$1</strong>');
  
  // Apply inline code formatting `code` -> code with black background
  htmlContent = htmlContent.replace(/`(.*?)`/g, '<code style="font-family:Consolas, Monaco, \'Courier New\', monospace; font-size:9.5pt; background-color:#0f172a; color:#38bdf8; padding:2px 6px; border-radius:4px; font-weight:bold; direction:ltr; unicode-bidi:embed;">$1</code>');

  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl'>
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
          font-family: 'Segoe UI', 'Traditional Arabic', Arial, sans-serif;
          margin: 1in;
          direction: rtl;
          text-align: right;
          background-color: #ffffff;
          color: #1e293b;
        }
      </style>
    </head>
    <body>
      <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-right:6px solid #4f46e5; padding:20px; margin-bottom:24px; border-radius:8px; direction:rtl; text-align:right;">
        <h1 style="color:#1e1b4b; font-family:'Segoe UI', 'Traditional Arabic', Arial, sans-serif; font-size:22pt; margin:0 0 8px 0; font-weight:bold;">${title}</h1>
        ${videoUrl ? `<p style="color:#475569; font-family:'Segoe UI', Arial, sans-serif; font-size:10pt; margin:0 0 6px 0;"><b>رابط الفيديو الأصلي:</b> <a href="${videoUrl}" style="color:#4f46e5;">${videoUrl}</a></p>` : ''}
        <p style="color:#94a3b8; font-family:'Segoe UI', Arial, sans-serif; font-size:9pt; margin:0; border-top:1px solid #e2e8f0; padding-top:8px;">تم توليد هذا الملخص الدراسي مهيكلاً ومنسقاً بنسبة 100% احترافية بواسطة منصة التمهيد الأكاديمية الذكية</p>
      </div>
      <div style="direction:rtl; text-align:right;">
        ${htmlContent}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword;charset=utf-8' });
  const element = document.createElement('a');
  element.href = URL.createObjectURL(blob);
  element.download = `${title.replace(/[^\w\s\u0600-\u06FF]/gi, '_').replace(/\s+/g, '_')}_ملخص_دراسي.doc`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
