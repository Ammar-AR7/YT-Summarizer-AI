/**
 * Unit Tests — HTML Exporter & Markdown Parsing
 */
import { markdownToHtml, flushTable, generateWordDocument } from '../../../server/helpers/htmlExporter';

describe('HTML Exporter Helper', () => {
  test('flushTable should format Markdown table rows into HTML table', () => {
    const rows = [
      ['المفهوم', 'الشرح'],
      ['GetX', 'إدارة الحالة في فلاتر'],
      ['Clean Architecture', 'تقسيم الطبقات']
    ];
    const html = flushTable(rows, 2);

    expect(html).toContain('<table');
    expect(html).toContain('المفهوم');
    expect(html).toContain('إدارة الحالة في فلاتر');
    expect(html).toContain('Clean Architecture');
  });

  test('markdownToHtml should parse headers, bold text and code correctly', () => {
    const markdown = `# عنوان رئيسي\n## عنوان فرعي\nهذا نص **مهم جداً** ورمز \`console.log\`.`;
    const html = markdownToHtml(markdown);

    expect(html).toContain('<h1');
    expect(html).toContain('عنوان رئيسي');
    expect(html).toContain('<h2');
    expect(html).toContain('عنوان فرعي');
    expect(html).toContain('<strong');
    expect(html).toContain('مهم جداً');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  test('generateWordDocument should output valid Word HTML wrapper', () => {
    const doc = generateWordDocument('ملخص تجريبي', '<p>محتوى</p>', 'https://youtube.com/watch?v=123');
    expect(doc).toContain('xmlns:w="urn:schemas-microsoft-com:office:office:word"');
    expect(doc).toContain('ملخص تجريبي');
    expect(doc).toContain('https://youtube.com/watch?v=123');
  });
});
