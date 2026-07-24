import { NotionCredentials } from '../types.js';

interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: any;
}

const ALLOWED_NOTION_LANGUAGES = new Set([
  "abap", "abc", "agda", "arduino", "ascii art", "assembly", "bash", "basic", "bnf", "c", "c#", "c++", "clojure", "coffeescript", "coq", "css", "dart", "dhall", "diff", "docker", "ebnf", "elixir", "elm", "erlang", "f#", "flow", "fortran", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "hcl", "html", "idris", "java", "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript", "lua", "makefile", "markdown", "markup", "matlab", "mathematica", "mermaid", "nix", "notion formula", "objective-c", "ocaml", "pascal", "perl", "php", "plain text", "powershell", "prolog", "protobuf", "purescript", "python", "r", "racket", "reason", "ruby", "rust", "sass", "scala", "scheme", "scss", "shell", "smalltalk", "solidity", "sql", "swift", "toml", "typescript", "vb.net", "verilog", "vhdl", "visual basic", "webassembly", "xml", "yaml"
]);

function normalizeNotionLanguage(lang: string): string {
  if (!lang) return 'plain text';
  const l = lang.toLowerCase().trim();
  if (l === 'csharp' || l === 'cs') return 'c#';
  if (l === 'cpp') return 'c++';
  if (l === 'js') return 'javascript';
  if (l === 'ts') return 'typescript';
  if (l === 'py') return 'python';
  if (l === 'sh') return 'shell';
  if (l === 'yml') return 'yaml';
  if (ALLOWED_NOTION_LANGUAGES.has(l)) return l;
  return 'plain text';
}

/**
 * Parses markdown into Notion blocks with rich styling and PDF/Word document-like colors.
 * Supports: Headings with block colors, Callout boxes, Quote blocks, Dividers, Tables, Code blocks, Lists, and Rich Text formatting.
 */
interface NotionRichText {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

function parseInlineMarkdown(text: string): NotionRichText[] {
  if (!text) return [{ type: 'text', text: { content: '' } }];

  const tokens: NotionRichText[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: { content: text.substring(lastIndex, match.index) }
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push({
        type: 'text',
        text: { content: matchedStr.slice(2, -2) },
        annotations: { bold: true } // Crisp dark bold text like a PDF/Word document
      });
    } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      tokens.push({
        type: 'text',
        text: { content: matchedStr.slice(1, -1) },
        annotations: { italic: true }
      });
    } else if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      tokens.push({
        type: 'text',
        text: { content: matchedStr.slice(1, -1) },
        annotations: { code: true, color: 'pink' }
      });
    } else if (matchedStr.startsWith('[') && matchedStr.includes('](')) {
      const closingBracket = matchedStr.indexOf(']');
      const linkText = matchedStr.substring(1, closingBracket);
      const linkUrl = matchedStr.substring(closingBracket + 2, matchedStr.length - 1);
      tokens.push({
        type: 'text',
        text: { content: linkText, link: { url: linkUrl } },
        annotations: { color: 'blue', underline: true }
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: { content: text.substring(lastIndex) }
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', text: { content: text } }];
}

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = markdown.split('\n');
  
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLanguage = 'plain text';

  let inTable = false;
  let tableRows: string[][] = [];
  let tableWidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: codeContent.join('\n') } }],
            language: codeLanguage
          }
        });
        codeContent = [];
        inCodeBlock = false;
      } else {
        // Open code block
        inCodeBlock = true;
        const lang = trimmed.slice(3).trim();
        codeLanguage = normalizeNotionLanguage(lang);
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Dividers
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
      continue;
    }

    // Parse tables: must start with '|' and end with '|'
    if (!inCodeBlock && trimmed.startsWith('|') && trimmed.endsWith('|')) {
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
      // Flush table block
      if (tableRows.length > 0) {
        const children = tableRows.map(row => {
          while (row.length < tableWidth) {
            row.push('');
          }
          return {
            object: 'block',
            type: 'table_row',
            table_row: {
              cells: row.map(cellText => parseInlineMarkdown(cellText))
            }
          };
        });

        blocks.push({
          object: 'block',
          type: 'table',
          table: {
            table_width: tableWidth,
            has_column_header: true,
            has_row_header: false,
            children: children.slice(0, 99)
          }
        });
      }
      inTable = false;
      tableRows = [];
      tableWidth = 0;
    }

    // Skip empty lines in general
    if (!trimmed) {
      continue;
    }

    // Callout / Note Blocks (> [!NOTE] or > 💡 or > ⚠️ or > 📌)
    if (trimmed.startsWith('> [!') || trimmed.startsWith('> 💡') || trimmed.startsWith('> ⚠️') || trimmed.startsWith('> 📌') || trimmed.startsWith('> 🎓')) {
      let emoji = '💡';
      if (trimmed.includes('⚠️')) emoji = '⚠️';
      if (trimmed.includes('📌')) emoji = '📌';
      if (trimmed.includes('🎓')) emoji = '🎓';
      
      const cleanContent = trimmed.replace(/^>\s*(\[![\w\s]+\]|💡|⚠️|📌|🎓)?\s*/, '');
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: parseInlineMarkdown(cleanContent),
          icon: { emoji },
          color: emoji === '⚠️' ? 'red_background' : emoji === '🎓' ? 'blue_background' : emoji === '📌' ? 'yellow_background' : 'gray_background'
        }
      });
      continue;
    }

    // Quotes (> quote)
    if (trimmed.startsWith('> ')) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: parseInlineMarkdown(trimmed.slice(2)),
          color: 'gray'
        }
      });
      continue;
    }

    // Headings with Document Color Styling (clean, elegant hierarchy)
    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: parseInlineMarkdown(trimmed.slice(2)),
          color: 'blue' // Elegant sapphire title text
        }
      });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: parseInlineMarkdown(trimmed.slice(3)),
          color: 'purple' // Subtle purple section heading
        }
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: parseInlineMarkdown(trimmed.slice(4)),
          color: 'gray' // Clean slate subsection heading
        }
      });
    } 
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineMarkdown(trimmed.slice(2))
        }
      });
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineMarkdown(content)
        }
      });
    }
    // Paragraphs with inline highlight
    else {
      // Check if paragraph starts with a key label like "**ملاحظة:**" or "**تنبيه:**" or "**الخلاصة:**"
      if (trimmed.startsWith('**ملاحظة:**') || trimmed.startsWith('**تنبيه:**') || trimmed.startsWith('**خلاصة:**') || trimmed.startsWith('**هام:**')) {
        blocks.push({
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: parseInlineMarkdown(trimmed),
            icon: { emoji: '📌' },
            color: 'yellow_background'
          }
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: parseInlineMarkdown(trimmed)
          }
        });
      }
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && codeContent.length > 0) {
    blocks.push({
      object: 'block',
      type: 'code',
      code: {
        rich_text: [{ type: 'text', text: { content: codeContent.join('\n') } }],
        language: codeLanguage
      }
    });
  }

  // Handle unclosed table
  if (inTable && tableRows.length > 0) {
    const children = tableRows.map(row => {
      while (row.length < tableWidth) {
        row.push('');
      }
      return {
        object: 'block',
        type: 'table_row',
        table_row: {
          cells: row.map(cellText => [
            {
              type: 'text',
              text: { content: cellText }
            }
          ])
        }
      };
    });

    blocks.push({
      object: 'block',
      type: 'table',
      table: {
        table_width: tableWidth,
        has_column_header: true,
        has_row_header: false,
        children: children.slice(0, 99)
      }
    });
  }

  // Notion limits block creation to 100 blocks per request
  return blocks.slice(0, 99);
}

/**
 * Sends a summary directly to the user's Notion database.
 */
export async function exportToNotion(
  credentials: NotionCredentials,
  videoTitle: string,
  videoUrl: string,
  summaryMarkdown: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { apiKey, databaseId } = credentials;

    if (!apiKey || !databaseId) {
      throw new Error('بيانات Notion غير مكتملة. يرجى إعداد مفتاح API ومعرف قاعدة البيانات.');
    }

    const blocks = markdownToNotionBlocks(summaryMarkdown);

    // Create Notion page
    let response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          // Standard title property is 'Name' in Notion. Fallback will be handled.
          Name: {
            title: [
              {
                text: {
                  content: videoTitle
                }
              }
            ]
          },
          URL: {
            url: videoUrl
          }
        },
        children: blocks
      })
    });

    let data = await response.json() as any;

    // Smart Retry: If it fails because "URL" property is missing/invalid in the user's custom Notion database
    if (!response.ok && data.code === 'validation_error' && (data.message?.toLowerCase().includes('url'))) {
      console.warn('[Notion Export] "URL" property validation failed. Retrying without "URL" property...');
      response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: videoTitle
                  }
                }
              ]
            }
          },
          children: blocks
        })
      });
      data = await response.json() as any;
    }

    if (!response.ok) {
      console.error('Notion API error details:', data);
      let errorMsg = 'فشل التصدير إلى Notion.';
      if (data.code === 'unauthorized') {
        errorMsg = 'مفتاح التكامل (API Token) الخاص بـ Notion غير صالح أو منتهي الصلاحية. يرجى التحقق منه في الإعدادات والتأكد من أنه يبدأ بـ "secret_".';
      } else if (data.code === 'object_not_found') {
        errorMsg = 'لم نتمكن من العثور على قاعدة بيانات Notion. يرجى التأكد من أن "معرف قاعدة البيانات" (Database ID) صحيح، وأنه قد تم ربط وإضافة التكامل الخاص بك (Connections) إلى هذه قاعدة البيانات داخل Notion عبر قائمة الثلاث نقاط (Add connections).';
      } else if (data.code === 'validation_error') {
        errorMsg = 'خطأ في التحقق من بنية قاعدة بيانات Notion (Validation Error). يرجى التأكد من أن قاعدة البيانات تحتوي على عمود بعنوان "Name" أو "العنوان" (من نوع Title وهو العمود الرئيسي الإلزامي).';
        if (data.message) {
          errorMsg += `\nتفاصيل الخطأ من Notion: ${data.message}`;
        }
      } else if (data.message) {
        errorMsg = `خطأ من Notion: ${data.message} (كود: ${data.code || 'غير معروف'})`;
      }
      throw new Error(errorMsg);
    }

    return {
      success: true,
      url: data.url || `https://notion.so/${databaseId}`
    };
  } catch (error: any) {
    console.error('Notion export service error:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء الاتصال بـ Notion'
    };
  }
}
