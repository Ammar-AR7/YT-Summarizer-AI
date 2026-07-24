import html2pdf from 'html2pdf.js';

/**
 * Utility to generate and trigger a direct PDF document download
 * from structured markdown text with custom styles, RTL layout, code block comments, and headers.
 */
function flushTableToHtml(rows: string[][], width: number): string {
  if (rows.length === 0) return '';
  
  let html = '<table style="width: 100%; border-collapse: collapse; margin: 18px 0; direction: rtl; text-align: right; border: 1px solid #e2e8f0; font-family: \'Segoe UI\', Arial, sans-serif; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); border-radius: 10px; overflow: hidden;">';
  
  // Headers
  const headerRow = rows[0];
  html += '<thead><tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">';
  for (let i = 0; i < width; i++) {
    const text = headerRow[i] || '';
    html += `<th style="padding: 12px 16px; text-align: right; font-weight: bold; color: #1e1b4b; font-size: 11pt; border: 1px solid #e2e8f0;">${text}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Body rows
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const bgColor = r % 2 === 0 ? '#f8fafc' : '#ffffff';
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #f1f5f9;">`;
    for (let c = 0; c < width; c++) {
      const text = row[c] || '';
      html += `<td style="padding: 10px 16px; text-align: right; color: #475569; font-size: 10pt; border: 1px solid #e2e8f0; line-height: 1.5;">${text}</td>`;
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

export function downloadAsPdf(title: string, summaryText: string, videoUrl?: string) {
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
        htmlContent += `<div style="margin: 14px 0; background-color: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b; direction: ltr; text-align: left;">
          ${codeLang ? `<div style="background-color: #1e293b; color: #94a3b8; font-family: Consolas, 'Courier New', monospace; font-size: 8pt; padding: 4px 12px; border-bottom: 1px solid #334155; font-weight: bold; text-transform: uppercase;">${codeLang}</div>` : ''}
          <pre style="margin: 0; padding: 12px 16px; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; white-space: pre-wrap; word-break: break-all; direction: ltr; text-align: left;"><code>${formattedCodeLines}</code></pre>
        </div>`;
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
      htmlContent += flushTableToHtml(tableRows, tableWidth);
      inTable = false;
      tableRows = [];
      tableWidth = 0;
    }

    if (!trimmed) {
      htmlContent += '<div style="height: 8px;"></div>';
      continue;
    }
    
    // Header 1
    if (trimmed.startsWith('# ')) {
      htmlContent += `<h1 style="color:#4f46e5; font-family:'Segoe UI', Arial, sans-serif; font-size:20pt; margin-top:22pt; margin-bottom:10pt; border-bottom:2px solid #e0e7ff; padding-bottom:6pt; direction:rtl; text-align:right;">${trimmed.slice(2)}</h1>`;
    }
    // Header 2
    else if (trimmed.startsWith('## ')) {
      htmlContent += `<h2 style="color:#1e1b4b; font-family:'Segoe UI', Arial, sans-serif; font-size:15pt; margin-top:18pt; margin-bottom:8pt; border-bottom:1px solid #f1f5f9; padding-bottom:4pt; direction:rtl; text-align:right;">${trimmed.slice(3)}</h2>`;
    }
    // Header 3
    else if (trimmed.startsWith('### ')) {
      htmlContent += `<h3 style="color:#334155; font-family:'Segoe UI', Arial, sans-serif; font-size:12pt; margin-top:14pt; margin-bottom:6pt; direction:rtl; text-align:right;">${trimmed.slice(4)}</h3>`;
    }
    // Bullet list items
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      htmlContent += `<div style="display: flex; align-items: start; gap: 8px; margin-bottom: 6px; direction: rtl; text-align: right;">
        <span style="color: #4f46e5; font-size: 11pt; margin-top: 2px;">•</span>
        <p style="font-family:'Segoe UI', Arial, sans-serif; font-size:11pt; color:#334155; margin: 0; line-height:1.6;">${trimmed.slice(2)}</p>
      </div>`;
    }
    // Numbered list items
    else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '');
      const num = trimmed.match(/^\d+/)?.[0] || '1';
      htmlContent += `<div style="display: flex; align-items: start; gap: 8px; margin-bottom: 6px; direction: rtl; text-align: right;">
        <span style="color:#4f46e5; font-weight:bold; font-family:'Segoe UI', Arial, sans-serif; font-size:11pt;">${num}.</span>
        <p style="font-family:'Segoe UI', Arial, sans-serif; font-size:11pt; color:#334155; margin: 0; line-height:1.6;">${content}</p>
      </div>`;
    }
    // Normal paragraph
    else {
      htmlContent += `<p style="font-family:'Segoe UI', Arial, sans-serif; font-size:11pt; color:#334155; line-height:1.7; direction:rtl; text-align:right; margin-bottom:10pt;">${trimmed}</p>`;
    }
  }

  // Handle unclosed table
  if (inTable && tableRows.length > 0) {
    htmlContent += flushTableToHtml(tableRows, tableWidth);
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    const formattedCodeLines = codeBlockLines.map(l => formatCodeLineWithArabicComments(l)).join('\n');
    htmlContent += `<div style="margin: 14px 0; background-color: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b; direction: ltr; text-align: left;">
      <pre style="margin: 0; padding: 12px 16px; background-color: #0f172a; color: #38bdf8; font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; line-height: 1.5; white-space: pre-wrap; word-break: break-all; direction: ltr; text-align: left;"><code>${formattedCodeLines}</code></pre>
    </div>`;
  }

  // Apply inline bold formatting **bold** -> strong (with a beautiful highlight)
  htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#4f46e5; font-weight:bold; background-color:#f5f3ff; padding:1px 3px; border-radius:4px;">$1</strong>');
  
  // Apply inline code formatting `code` -> code with black background
  htmlContent = htmlContent.replace(/`(.*?)`/g, '<code style="font-family:Consolas, Monaco, \'Courier New\', monospace; font-size:9.5pt; background-color:#0f172a; border:1px solid #1e293b; color:#38bdf8; padding:2px 6px; border-radius:4px; direction: ltr; unicode-bidi: embed; font-weight:bold;">$1</code>');

  // Create container in DOM for html2canvas/html2pdf layout engine
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '800px';
  container.style.zIndex = '-9999';
  container.style.opacity = '0.99';
  container.style.direction = 'rtl';
  container.style.textAlign = 'right';
  container.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  container.style.padding = '24px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#334155';

  container.innerHTML = `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-right: 6px solid #4f46e5; padding: 20px; margin-bottom: 24px; border-radius: 12px; direction: rtl; text-align: right;">
      <h1 style="color: #1e1b4b; font-size: 20pt; margin: 0 0 8px 0; font-weight: bold; line-height: 1.3;">${title}</h1>
      ${videoUrl ? `<p style="color: #475569; font-size: 9.5pt; margin: 0 0 6px 0; word-break: break-all;"><b>رابط الفيديو الأصلي:</b> <a href="${videoUrl}" target="_blank" style="color: #4f46e5;">${videoUrl}</a></p>` : ''}
      <p style="color: #94a3b8; font-size: 8.5pt; margin: 10px 0 0 0; border-top: 1px solid #e2e8f0; padding-top: 8px;">تنسيق وتصدير تلقائي فائق الدقة بواسطة منصة التمهيد الأكاديمية الذكية</p>
    </div>
    <div style="direction: rtl; text-align: right;">
      ${htmlContent}
    </div>
  `;

  document.body.appendChild(container);

  const cleanFilename = `${title.replace(/[^\w\s\u0600-\u06FF]/gi, '_').substring(0, 50)}_ملخص_دراسي.pdf`;

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: cleanFilename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800, scrollX: 0, scrollY: 0, allowTaint: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };

  const cleanup = () => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  };

  try {
    const worker = html2pdf().set(opt).from(container).save();
    if (worker && typeof worker.then === 'function') {
      worker.then(cleanup).catch(cleanup);
    } else {
      setTimeout(cleanup, 2000);
    }
  } catch (err) {
    console.warn('html2pdf direct download fallback triggered:', err);
    cleanup();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<html><head><title>${title}</title></head><body>${container.innerHTML}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  }
}

