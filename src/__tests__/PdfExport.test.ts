import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}

import { convertMarkdownToPdfHtml } from '../lib/pdfExport';

describe('PDF Export Unit Tests - convertMarkdownToPdfHtml', () => {
  test('generates valid HTML with RTL direction and Cairo font', () => {
    const markdown = `# مقدمة في الذكاء الاصطناعي
هذا ملخص شامل للدرس الأول.

## النقاط الرئيسية
- التعلم العميق
- الشبكات العصبية
- معالجة اللغات الطبيعية

| المفهوم | الوصف |
| --- | --- |
| الذكاء الاصطناعي | محاكاة العقل البشري |
| التعلم الآلي | تحسين الأداء بالبيانات |

> ملاحظة هامة: يجب مراجعة المفاهيم بانتظام.
`;

    const html = convertMarkdownToPdfHtml(markdown, 'اختبار الملخص الدراس', 'https://youtube.com/watch?v=12345');

    // RTL verification
    expect(html).toContain('direction: rtl');
    expect(html).toContain("font-family: 'Cairo'");

    // Content verification
    expect(html).toContain('اختبار الملخص الدراس');
    expect(html).toContain('مقدمة في الذكاء الاصطناعي');
    expect(html).toContain('النقاط الرئيسية');
    expect(html).toContain('التعلم العميق');
    expect(html).toContain('الشبكات العصبية');
    expect(html).toContain('الذكاء الاصطناعي');
    expect(html).toContain('ملاحظة هامة');
    expect(html).toContain('https://youtube.com/watch?v=12345');

    // Table structure
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');

    // List structure
    expect(html).toContain('<ul');
    expect(html).toContain('<li');

    // Blockquote
    expect(html).toContain('<blockquote');
  });

  test('handles inline formatting like bold, code, and highlights safely', () => {
    const markdown = 'هذه كلمة **مهامة جداً** مع كود `const x = 10;` وتظليل ==نص بارز==.';
    const html = convertMarkdownToPdfHtml(markdown, 'عنوان الاختبار');

    expect(html).toContain('<strong style="color: #0f172a; font-weight: 700;">مهامة جداً</strong>');
    expect(html).toContain('<code');
    expect(html).toContain('const x = 10;');
    expect(html).toContain('<mark style="background-color: #fef08a;');
    expect(html).toContain('نص بارز');
  });

  test('escapes HTML tags inside markdown to prevent XSS injection', () => {
    const markdown = 'نص مع <script>alert("xss")</script> وتسمية عادي.';
    const html = convertMarkdownToPdfHtml(markdown, 'عنوان آمن');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
