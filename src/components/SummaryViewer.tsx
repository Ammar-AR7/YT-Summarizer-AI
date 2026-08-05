import React, { useState, useEffect } from 'react';
import { Copy, Download, ExternalLink, ArrowRightLeft, Sparkles, Check, AlertOctagon, HelpCircle, FileText, Printer, Edit3, Save, X, Undo, Maximize2, Minimize2 } from 'lucide-react';
import { NotionCredentials } from '../types';
import { downloadAsWord } from '../lib/wordExport';
import { downloadAsPdf, printSummary } from '../lib/pdfExport';
import { updateSummaryText, saveUserConfig } from '../services/firebaseService';

interface SummaryViewerProps {
  title: string;
  summaryText: string;
  videoUrl: string;
  videoId: string;
  summaryId?: string | null;
  ownerId?: string | null;
  currentUserId?: string | null;
  onSummaryEdited?: (newText: string) => void;
  notionCredentials?: NotionCredentials | null;
  onNotionCredentialsUpdated?: (creds: NotionCredentials) => void;
  onClose?: () => void;
}

/**
 * Custom High-Fidelity Markdown Parser & HTML Renderer.
 * Translates typical markdown, tables, custom corrected errors, and Gemini examples into a stunning RTL layout.
 */
function parseMarkdownToReact(markdown: string) {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLang = '';
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  // Helper to replace standard Markdown inline formatting (**bold**, *italics*, `code`)
  const parseInline = (text: string): React.ReactNode[] => {
    // Escape simple characters, convert **bold** to strong, `code` to span
    const parts: React.ReactNode[] = [];
    let currentText = text;

    // Direct simple replacement of bold and inline code
    const boldRegex = /\*\*(.*?)\*\*/g;
    const codeRegex = /`(.*?)`/g;

    // For simplicity and robust react rendering:
    // We split by standard markings
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Use a unified matching mechanism or render formatted text
    // Replace markdown inline highlights
    const boldParts = text.split(/\*\*/g);
    for (let i = 0; i < boldParts.length; i++) {
      if (i % 2 === 1) {
        // This is inside **bold**
        elements.push(<strong key={`b-${i}`} className="font-bold text-gray-900 bg-indigo-50/50 px-1 rounded">{boldParts[i]}</strong>);
      } else {
        // Split by backticks
        const codeParts = boldParts[i].split(/`/g);
        for (let j = 0; j < codeParts.length; j++) {
          if (j % 2 === 1) {
            elements.push(<code key={`c-${i}-${j}`} className="font-mono text-xs bg-gray-100 text-indigo-600 px-1.5 py-0.5 rounded border border-gray-200">{codeParts[j]}</code>);
          } else {
            elements.push(<span key={`t-${i}-${j}`}>{codeParts[j]}</span>);
          }
        }
      }
    }
    return elements;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Handle Code Blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        const finalCode = codeContent.join('\n');
        elements.push(
          <div key={`code-${i}`} className="my-5 bg-gray-900 text-gray-100 rounded-2xl overflow-hidden shadow-lg border border-gray-800 text-left" dir="ltr">
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between text-xs font-mono text-gray-400 border-b border-gray-850">
              <span>{codeLang || 'code'}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(finalCode)}
                className="hover:text-white transition-colors"
              >
                نسخ الشيفرة
              </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed">
              <code>{finalCode}</code>
            </pre>
          </div>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // 2. Handle Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      const parts = trimmed.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Check if it's separator line (e.g. |---|---|)
      const isSeparator = parts.every(p => p.startsWith('-'));
      if (isSeparator) {
        continue;
      }

      if (tableHeaders.length === 0) {
        tableHeaders = parts;
      } else {
        tableRows.push(parts);
      }
      continue;
    } else if (inTable && !trimmed.startsWith('|')) {
      // Close table
      const keyPrefix = `table-${i}`;
      elements.push(
        <div key={keyPrefix} className="my-6 overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
          <table className="w-full text-sm text-right text-gray-500" dir="rtl">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100 font-bold">
              <tr>
                {tableHeaders.map((h, idx) => (
                  <th key={`th-${idx}`} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`} className="bg-white border-b border-gray-50 hover:bg-gray-50/50 transition-all">
                  {row.map((cell, cellIdx) => (
                    <td key={`td-${rowIdx}-${cellIdx}`} className="px-4 py-2.5 text-xs text-gray-600 font-sans">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // 3. Handle Special Prompts Components (Correction:, Example Gemini:)
    if (trimmed.includes('Correction:')) {
      const parts = trimmed.split('Correction:');
      const text = parts[1] || '';
      elements.push(
        <div key={`correct-${i}`} className="my-5 p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex gap-3 text-right">
          <div className="text-amber-500 shrink-0 mt-0.5">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div className="font-sans">
            <h4 className="text-xs font-bold text-amber-900 mb-1">تصحيح وتدقيق علمي (Correction)</h4>
            <p className="text-xs text-amber-700 leading-relaxed">{parseInline(text)}</p>
          </div>
        </div>
      );
      continue;
    }

    if (trimmed.includes('Example Gemini:')) {
      const text = trimmed.replace('Example Gemini:', '').trim();
      elements.push(
        <div key={`example-${i}`} className="my-5 p-4 bg-teal-50/40 border border-teal-100 rounded-2xl flex gap-3 text-right">
          <div className="text-teal-500 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="font-sans">
            <h4 className="text-xs font-bold text-teal-900 mb-1">مثال تطبيقي مبتكر (Example Gemini)</h4>
            <p className="text-xs text-teal-700 leading-relaxed font-mono">{parseInline(text)}</p>
          </div>
        </div>
      );
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="font-sans font-extrabold text-gray-900 text-lg sm:text-xl border-b border-gray-100 pb-2 mt-8 mb-4">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="font-sans font-bold text-gray-800 text-sm sm:text-base mt-6 mb-3">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="font-sans font-bold text-gray-700 text-xs sm:text-sm mt-5 mb-2">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    }
    // 5. Bullet Points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1.5 font-sans">
          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0 mt-1.5"></span>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{parseInline(trimmed.slice(2))}</p>
        </div>
      );
    }
    // 6. Numbered List Items
    else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^\d+/)![0];
      const content = trimmed.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1.5 font-sans">
          <span className="text-xs font-bold text-indigo-600 shrink-0 mt-0.5">{num}.</span>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{parseInline(content)}</p>
        </div>
      );
    }
    // 7. Default Paragraph
    else {
      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans my-3">
          {parseInline(trimmed)}
        </p>
      );
    }
  }

  return elements;
}

export default function SummaryViewer({ 
  title, 
  summaryText, 
  videoUrl, 
  videoId, 
  summaryId,
  ownerId,
  currentUserId,
  onSummaryEdited,
  notionCredentials,
  onNotionCredentialsUpdated,
  onClose 
}: SummaryViewerProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Fullscreen Reading Mode state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen to Escape key to exit fullscreen reading mode smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(summaryText);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Document Refinement states
  const [refining, setRefining] = useState(false);
  const [refineStatus, setRefineStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Notion Prompt / Onboarding states
  const [showNotionPrompt, setShowNotionPrompt] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [savingNotionCreds, setSavingNotionCreds] = useState(false);
  const [notionPromptError, setNotionPromptError] = useState<string | null>(null);

  const isOwner = !!(currentUserId && ownerId && currentUserId === ownerId);

  const startEditing = () => {
    setEditedText(summaryText);
    setIsEditing(true);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!summaryId) {
      setEditError('معرّف الملخص غير متوفر.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      // Save current text to history before modifying
      setHistory(prev => [...prev, summaryText]);

      await updateSummaryText(summaryId, editedText);
      if (onSummaryEdited) {
        onSummaryEdited(editedText);
      }
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update summary:', err);
      setEditError(err.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Generate .md file
    const element = document.createElement('a');
    const file = new Blob([summaryText], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}_ملخص_دراسي.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadWord = () => {
    downloadAsWord(title, summaryText, videoUrl);
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadAsPdf(title, summaryText, videoUrl);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    }
  };

  const handlePrintPdf = () => {
    printSummary(title, summaryText, videoUrl);
  };

  const handleRefineDocument = async (mode: 'academic_tables' | 'concise_text') => {
    setRefining(true);
    setRefineStatus(null);
    try {
      const response = await fetch('/api/document/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summaryMarkdown: summaryText,
          videoTitle: title,
          userId: currentUserId || 'anonymous',
          mode
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        // Save current state to history stack before modifying
        setHistory(prev => [...prev, summaryText]);

        setRefineStatus(
          mode === 'academic_tables' 
            ? 'تم تحسين وتنسيق المستند بنجاح بالذكاء الاصطناعي! ✨ تم تحويل الجداول والمفاهيم لهيكل أكاديمي منسق.' 
            : 'تم تبسيط وتلخيص المستند بنجاح! 📝 تم تنسيق المحتوى كملخص نصي وقوائم مباشرة دون جداول.'
        );
        // If owner and summary exists, update db
        if (isOwner && summaryId) {
          await updateSummaryText(summaryId, result.refinedSummary);
        }
        if (onSummaryEdited) {
          onSummaryEdited(result.refinedSummary);
        }
      } else {
        throw new Error(result.error || 'فشل تحسين المستند بالذكاء الاصطناعي.');
      }
    } catch (err: any) {
      console.error('Failed to refine document:', err);
      setRefineStatus(`فشل تحسين التنسيق: ${err.message}`);
    } finally {
      setRefining(false);
    }
  };

  const handleRevert = async () => {
    if (history.length === 0) return;
    const previousText = history[history.length - 1];
    
    setRefining(true);
    setRefineStatus(null);
    try {
      // Update Firestore if owner and summary exists
      if (isOwner && summaryId) {
        await updateSummaryText(summaryId, previousText);
      }
      
      // Update in UI
      if (onSummaryEdited) {
        onSummaryEdited(previousText);
      }

      // Pop from history
      setHistory(prev => prev.slice(0, prev.length - 1));
      setRefineStatus('تم التراجع بنجاح والعودة للمسودة السابقة! ↩️');
    } catch (err: any) {
      console.error('Failed to revert:', err);
      setRefineStatus(`فشل التراجع عن التعديل: ${err.message}`);
    } finally {
      setRefining(false);
    }
  };

  const handleSaveNotionCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      setNotionPromptError('يرجى تسجيل الدخول أولاً لحفظ وتكامل حساب Notion الخاص بك.');
      return;
    }

    if (!notionApiKey.trim() || !notionDbId.trim()) {
      setNotionPromptError('الرجاء إدخال رمز التكامل ومعرف قاعدة البيانات بالكامل.');
      return;
    }

    setSavingNotionCreds(true);
    setNotionPromptError(null);

    const newCreds: NotionCredentials = {
      apiKey: notionApiKey.trim(),
      databaseId: notionDbId.trim()
    };

    try {
      // Save to firebase
      await saveUserConfig(currentUserId, {
        notionCredentials: newCreds
      });

      // Update parent state
      if (onNotionCredentialsUpdated) {
        onNotionCredentialsUpdated(newCreds);
      }

      setShowNotionPrompt(false);
      setExportStatus('تم ربط حساب Notion بنجاح! جاري التصدير الآن...');
      
      // Trigger the export immediately with these new credentials!
      setExporting(true);
      const response = await fetch('/api/notion/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentials: newCreds,
          videoTitle: title,
          videoUrl,
          summaryMarkdown: summaryText
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setExportStatus(`تم الربط والتصدير بنجاح! 🎉 الرابط: ${result.url}`);
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else {
        throw new Error(result.error || 'فشل التصدير بعد ربط الحساب.');
      }
    } catch (err: any) {
      console.error('Notion save and export error:', err);
      setNotionPromptError(err.message || 'حدث خطأ أثناء حفظ الإعدادات والتصدير.');
    } finally {
      setSavingNotionCreds(false);
      setExporting(false);
    }
  };

  const handleNotionExport = async () => {
    if (!notionCredentials) {
      setShowNotionPrompt(true);
      return;
    }

    setExporting(true);
    setExportStatus(null);

    try {
      const response = await fetch('/api/notion/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credentials: notionCredentials,
          videoTitle: title,
          videoUrl,
          summaryMarkdown: summaryText
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setExportStatus(`تم التصدير بنجاح! 🎉 الرابط: ${result.url}`);
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else {
        throw new Error(result.error || 'فشل الاتصال بالخادم للتصدير إلى Notion.');
      }
    } catch (err: any) {
      console.error('Notion export error:', err);
      setExportStatus(`فشل تصدير الملاحظات لـ Notion: ${err.message || 'حدث خطأ.'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div 
      className={`bg-white transition-all duration-300 ${
        isFullscreen 
          ? 'fixed inset-0 z-[100] w-screen h-screen overflow-y-auto m-0 rounded-none border-0 p-3 sm:p-8 shadow-2xl flex flex-col' 
          : 'rounded-2xl border border-gray-100 shadow-sm overflow-hidden'
      }`} 
      id="summary-viewer"
    >
      
      {/* Viewer Header */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200/50 p-3.5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4" dir="rtl">
        <div className="space-y-1.5 text-right w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white font-medium text-[10px] px-2 py-0.5 rounded">ملخص دراسي</span>
            <span className="text-[11px] text-gray-400 font-mono font-sans">{videoId}</span>
            {isFullscreen && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">وضع ملء الشاشة 📖</span>
            )}
          </div>
          <h2 className="font-sans font-bold text-gray-900 text-sm sm:text-base leading-snug line-clamp-1">{title}</h2>
        </div>

        {/* Floating Action Bar — يمرر أفقياً على الجوال */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end overflow-x-auto pb-1 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-hide">
          
          {/* Fullscreen Reading Mode Toggle Button */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
              isFullscreen 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-2 ring-indigo-300' 
                : 'bg-white border border-indigo-100/80 hover:bg-indigo-50 text-indigo-700'
            }`}
            title={isFullscreen ? "إغلاق وضع ملء الشاشة (Esc)" : "عرض الملخص في وضع ملء الشاشة القراءة المريحة 📖"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-indigo-600" />}
            <span className="hidden sm:inline">{isFullscreen ? 'خروج من ملء الشاشة (Esc)' : 'وضع ملء الشاشة 📖'}</span>
          </button>

          {/* AI Document Refiner Buttons */}
          {!isEditing && (
            <div className="flex flex-wrap items-center gap-1 bg-indigo-50 border border-indigo-100/60 p-1 rounded-xl">
              <button
                onClick={() => handleRefineDocument('academic_tables')}
                disabled={refining}
                className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                title="إعادة صياغة وتنسيق الملخص بالكامل بالذكاء الاصطناعي مع جداول أكاديمية احترافية"
              >
                <Sparkles className="w-3 h-3 text-yellow-300" />
                <span>{refining ? 'جاري التنسيق...' : 'تنسيق أكاديمي 📊'}</span>
              </button>

              <button
                onClick={() => handleRefineDocument('concise_text')}
                disabled={refining}
                className="px-2.5 py-1 bg-white hover:bg-gray-50 text-indigo-700 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-indigo-200/50 transition-all disabled:opacity-50 cursor-pointer"
                title="تبسيط الملخص وصياغته كنصوص وقوائم مباشرة دون أي جداول"
              >
                <FileText className="w-3 h-3 text-indigo-600" />
                <span>تبسيط مكثف 📝</span>
              </button>

              {history.length > 0 && (
                <button
                  onClick={handleRevert}
                  disabled={refining}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer animate-fade-in"
                  title="التراجع عن التغيير الأخير والعودة للحالة السابقة للمستند"
                >
                  <Undo className="w-3 h-3 text-rose-600" />
                  <span>تراجع ↩️</span>
                </button>
              )}
            </div>
          )}

          {/* Edit Button (Visible only to owner) */}
          {isOwner && !isEditing && (
            <button
              onClick={startEditing}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="تعديل محتوى الملخص"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل الملخص</span>
            </button>
          )}

          {/* Export to Notion */}
          <button
            onClick={handleNotionExport}
            disabled={exporting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{exporting ? 'جاري التصدير...' : 'تصدير لـ Notion'}</span>
          </button>

          {/* Copy as Markdown */}
          <button
            onClick={handleCopy}
            className="p-1.5 bg-white border border-gray-100 hover:bg-gray-50 text-indigo-600 hover:border-indigo-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="نسخ الملخص بصيغة Markdown"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم نسخ الـ Markdown' : 'نسخ كـ Markdown'}</span>
          </button>

          {/* Download Word file */}
          <button
            onClick={handleDownloadWord}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="تحميل كملف مستند Word منسق وملون"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">تحميل Word (.doc)</span>
          </button>

          {/* Download PDF file */}
          <button
            onClick={handleDownloadPdf}
            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="تحميل مباشر كملف PDF منسق"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">تحميل PDF (.pdf)</span>
          </button>

          {/* Download markdown file */}
          <button
            onClick={handleDownload}
            className="p-1.5 bg-white border border-gray-100 hover:bg-gray-50 text-gray-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            title="تحميل كملف Markdown نصي"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">تحميل (.md)</span>
          </button>

        </div>
      </div>

      {/* Notion Integration Onboarding Prompt */}
      {showNotionPrompt && (
        <div className="bg-slate-50 border-b border-slate-200 p-6 text-right" dir="rtl">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="font-sans font-bold text-gray-900 text-sm sm:text-base">ربط وتفعيل تكامل Notion 🔗</h3>
              </div>
              <button 
                onClick={() => setShowNotionPrompt(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-600 font-sans leading-relaxed">
              لم تقم بربط حساب Notion الخاص بك بعد. للتصدير المباشر والتلقائي لهذه الملاحظات إلى صفحتك الشخصية كجداول منظمة، يرجى إدخال رمز التكامل ومعرف قاعدة البيانات بالأسفل ليتم ربط وتصدير الملخص فوراً:
            </p>

            <form onSubmit={handleSaveNotionCredentials} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-sans font-semibold text-gray-600">رمز تكامل Notion (API Token)</label>
                  <input
                    type="password"
                    placeholder="secret_..."
                    value={notionApiKey}
                    onChange={(e) => setNotionApiKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 rounded-xl focus:outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-sans font-semibold text-gray-600">معرّف قاعدة البيانات (Database ID)</label>
                  <input
                    type="text"
                    placeholder="32 حرفاً ورقماً..."
                    value={notionDbId}
                    onChange={(e) => setNotionDbId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              {notionPromptError && (
                <p className="text-xs text-red-600 font-sans">{notionPromptError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNotionPrompt(false)}
                  className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingNotionCreds}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  {savingNotionCreds ? 'جاري الربط والتصدير...' : 'حفظ الإعدادات والتصدير الآن 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notion Status Log */}
      {exportStatus && (
        <div className="bg-blue-50 border-b border-blue-100 text-blue-700 text-xs px-6 py-2.5 text-right font-sans" dir="rtl">
          {exportStatus}
        </div>
      )}

      {/* Refine Status Log */}
      {refineStatus && (
        <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs px-6 py-2.5 text-right font-sans" dir="rtl">
          {refineStatus}
        </div>
      )}

      {/* Viewer Body with custom parsed Markdown or Editor */}
      <div className="p-3.5 sm:p-6 overflow-y-auto max-h-[70vh] bg-white text-right leading-relaxed select-text" dir="rtl">
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
              <span className="text-xs font-sans text-amber-600 font-bold flex items-center gap-1">
                <Edit3 className="w-4 h-4" />
                أنت تقوم بتعديل هذا الملخص الآن بصفتك المالك
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'جاري الحفظ...' : 'حفظ'}</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                  className="px-3 py-1 bg-gray-150 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إلغاء</span>
                </button>
              </div>
            </div>

            {editError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-4 py-2.5 rounded-xl font-sans" dir="rtl">
                {editError}
              </div>
            )}

            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              disabled={savingEdit}
              className="w-full h-[50vh] p-4 border border-indigo-100 focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100 rounded-2xl font-mono text-sm leading-relaxed text-gray-800 bg-gray-50/50 resize-y focus:outline-none"
              placeholder="اكتب الملخص الدراسي هنا بصيغة Markdown..."
              dir="rtl"
            />
            
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditing(false)}
                disabled={savingEdit}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>إلغاء التعديلات</span>
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                {savingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin font-sans"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{savingEdit ? 'جاري حفظ التعديلات...' : 'حفظ ونشر التعديلات'}</span>
              </button>
            </div>
          </div>
        ) : (
          parseMarkdownToReact(summaryText)
        )}
      </div>

      {/* Footer Meta */}
      <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px] text-gray-400 font-sans overflow-hidden" dir="rtl">
        <span className="truncate min-w-0 flex-1">فيديو يوتيوب الأصلي: <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{videoUrl}</a></span>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold">
            إغلاق الملخص ×
          </button>
        )}
      </div>

    </div>
  );
}
