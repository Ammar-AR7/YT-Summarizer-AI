/**
 * PDF Export Utility
 * Uses native browser printing for vector-perfect PDF generation without heavy canvas libraries.
 */

/**
 * Converts Markdown text into an executive, publication-grade HTML document
 * optimized for A4 PDF export and Arabic typography.
 */
export function convertMarkdownToPdfHtml(markdownText: string, title: string, videoUrl?: string): string {
  const lines = markdownText.split('\n');
  let html = '';
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  let inCodeBlock = false;
  let codeContent: string[] = [];

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const formatInline = (text: string): string => {
    let result = escapeHtml(text);
    // Bold **text**
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>');
    // Inline code `code`
    result = result.replace(/`(.*?)`/g, '<code style="background-color: #f1f5f9; color: #4338ca; padding: 2px 7px; border-radius: 4px; font-family: Consolas, Monaco, monospace; font-size: 12px; direction: ltr; display: inline-block;">$1</code>');
    // Highlight ==text==
    result = result.replace(/==(.*?)==/g, '<mark style="background-color: #fef08a; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: 600;">$1</mark>');
    return result;
  };

  const closeTable = () => {
    if (!inTable) return;
    html += `
      <div style="margin: 18px 0; width: 100%; page-break-inside: avoid; break-inside: avoid;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; text-align: right; direction: rtl; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <thead>
            <tr style="background-color: #1e1b4b; color: #ffffff;">`;
    tableHeaders.forEach(h => {
      html += `<th style="padding: 11px 14px; border-bottom: 2px solid #4338ca; font-weight: 700; text-align: right; color: #ffffff; font-family: 'Cairo', sans-serif;">${formatInline(h)}</th>`;
    });
    html += `</tr></thead><tbody>`;
    tableRows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      html += `<tr style="background-color: ${bg};">`;
      row.forEach(cell => {
        html += `<td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right; line-height: 1.6;">${formatInline(cell)}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const closeList = () => {
    if (!inList) return;
    html += `</${listType}>`;
    inList = false;
  };

  const closeCodeBlock = () => {
    if (!inCodeBlock) return;
    const code = codeContent.join('\n');
    html += `<div style="margin: 16px 0; page-break-inside: avoid; break-inside: avoid;">
      <pre style="background-color: #0f172a; color: #38bdf8; padding: 14px 18px; border-radius: 8px; font-family: Consolas, Monaco, monospace; font-size: 12px; direction: ltr; text-align: left; overflow-x: auto; line-height: 1.6; border: 1px solid #1e293b;"><code>${escapeHtml(code)}</code></pre>
    </div>`;
    inCodeBlock = false;
    codeContent = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        closeTable();
        closeList();
        inCodeBlock = true;
        codeContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Markdown Table handling
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());

      // Skip table separator line |---|---|
      if (cells.every(c => /^[:\-\s]+$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        tableRows = [];
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      closeTable();
    }

    // Unordered List - or *
    if (/^[\-\*]\s+/.test(trimmed)) {
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

    // Ordered List 1. 2.
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

    // If not list, close list
    if (inList) {
      closeList();
    }

    // Headings #, ##, ###
    if (trimmed.startsWith('# ')) {
      closeTable();
      const hText = trimmed.replace(/^#\s+/, '');
      html += `<h1 style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin-top: 26px; margin-bottom: 12px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h1>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      closeTable();
      const hText = trimmed.replace(/^##\s+/, '');
      html += `<h2 style="font-size: 16px; font-weight: 700; color: #312e81; background-color: #f5f3ff; border-right: 5px solid #4f46e5; padding: 8px 14px; border-radius: 6px; margin-top: 22px; margin-bottom: 12px; direction: rtl; text-align: right; font-family: 'Cairo', sans-serif; page-break-after: avoid; break-after: avoid;">${formatInline(hText)}</h2>`;
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

    // Empty line
    if (trimmed === '') {
      continue;
    }

    // Regular paragraph
    html += `<p style="margin: 8px 0; line-height: 1.8; color: #1e293b; font-size: 13.5px; direction: rtl; text-align: right;">${formatInline(trimmed)}</p>`;
  }

  // Close remaining tags
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
    <div style="width: 100%; max-width: 100%; background-color: #ffffff; margin: 0; padding: 0; box-sizing: border-box; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; direction: rtl; text-align: right; line-height: 1.8; word-wrap: break-word; overflow-wrap: break-word;">
      ${headerHtml}
      <div style="font-size: 13.5px; color: #1e293b; width: 100%; max-width: 100%; box-sizing: border-box;">
        ${html}
      </div>
      ${footerHtml}
    </div>
  `;
}

/**
 * Downloads document directly as a high-precision multi-page PDF via native printing.
 */
export async function downloadAsPdf(title: string, markdownText: string, videoUrl?: string): Promise<void> {
  printSummary(title, markdownText, videoUrl);
}

/**
 * Native Browser Print & Save-to-PDF function.
 * Opens the native browser print preview window where the user can save directly as a vector PDF.
 */
export function printSummary(title: string, markdownText: string, videoUrl?: string): void {
  const htmlContent = convertMarkdownToPdfHtml(markdownText, title, videoUrl);

  // 1. Remove previous printable root or print style tag if exists
  const existingRoot = document.getElementById('printable-pdf-root');
  if (existingRoot && document.body.contains(existingRoot)) {
    document.body.removeChild(existingRoot);
  }
  const existingStyle = document.getElementById('printable-pdf-styles');
  if (existingStyle && document.head.contains(existingStyle)) {
    document.head.removeChild(existingStyle);
  }

  // 2. Inject printable CSS style tag
  const styleEl = document.createElement('style');
  styleEl.id = 'printable-pdf-styles';
  styleEl.innerHTML = `
    @media print {
      @page {
        size: A4;
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
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important;
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

  // 3. Mount printable content root
  const printRoot = document.createElement('div');
  printRoot.id = 'printable-pdf-root';
  printRoot.innerHTML = htmlContent;
  document.body.appendChild(printRoot);

  // 4. Trigger window.print() smoothly
  const triggerPrint = () => {
    try {
      window.print();
    } catch (err) {
      console.error('window.print error:', err);
      alert('تعذر فتح شاشة الطباعة تلقائياً.');
    } finally {
      setTimeout(() => {
        if (document.body.contains(printRoot)) {
          document.body.removeChild(printRoot);
        }
        if (document.head.contains(styleEl)) {
          document.head.removeChild(styleEl);
        }
      }, 1000);
    }
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      setTimeout(triggerPrint, 250);
    });
  } else {
    setTimeout(triggerPrint, 350);
  }
}
