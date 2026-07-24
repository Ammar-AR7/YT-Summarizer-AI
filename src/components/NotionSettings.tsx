import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { getUserConfig, saveUserConfig } from '../services/firebaseService';
import { NotionCredentials, UserConfig } from '../types';
import { Settings, CheckCircle2, AlertTriangle, Key, Database, MessageSquare, ExternalLink, HelpCircle, Info, ChevronDown, ChevronUp, Sparkles, Bot } from 'lucide-react';

interface NotionSettingsProps {
  user: User | null;
  userConfig?: UserConfig | null;
  onConfigLoaded?: (config: UserConfig | null) => void;
}

export default function NotionSettings({ user, userConfig, onConfigLoaded }: NotionSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [botInfo, setBotInfo] = useState<{ botUsername?: string; botUrl?: string } | null>(null);

  // Fetch bot info with retry
  useEffect(() => {
    let isMounted = true;
    const fetchBotInfo = (attempts = 3) => {
      fetch('/api/telegram-bot-info')
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (isMounted && data.success) {
            setBotInfo({ botUsername: data.botUsername, botUrl: data.botUrl });
          }
        })
        .catch(err => {
          if (attempts > 1 && isMounted) {
            setTimeout(() => fetchBotInfo(attempts - 1), 1500);
          } else {
            console.warn('[Telegram Bot Info] Unavailable:', err.message);
          }
        });
    };
    fetchBotInfo();
    return () => { isMounted = false; };
  }, []);

  // Sync state if userConfig changes from outside
  useEffect(() => {
    const localGeminiKey = localStorage.getItem('user_gemini_api_key') || '';
    if (userConfig) {
      setApiKey(userConfig.notionCredentials?.apiKey || '');
      setDatabaseId(userConfig.notionCredentials?.databaseId || '');
      setTelegramId(userConfig.telegramId || '');
      setGeminiApiKey(userConfig.geminiApiKey || localGeminiKey);
      if (userConfig.notionCredentials?.apiKey || userConfig.notionCredentials?.databaseId || userConfig.geminiApiKey || localGeminiKey) {
        setIsEditing(false);
      }
    } else if (localGeminiKey) {
      setGeminiApiKey(localGeminiKey);
    }
  }, [userConfig]);

  // Load config when user changes
  useEffect(() => {
    const localGeminiKey = localStorage.getItem('user_gemini_api_key') || '';

    if (!user) {
      setGeminiApiKey(localGeminiKey);
      setIsEditing(!localGeminiKey);
      return;
    }

    const loadConfig = async () => {
      setLoading(true);
      try {
        const config = await getUserConfig(user.uid);
        if (config) {
          const loadedApiKey = config.notionCredentials?.apiKey || '';
          const loadedDatabaseId = config.notionCredentials?.databaseId || '';
          const loadedTelegramId = config.telegramId || '';
          const loadedGeminiApiKey = config.geminiApiKey || localGeminiKey;
          
          setApiKey(loadedApiKey);
          setDatabaseId(loadedDatabaseId);
          setTelegramId(loadedTelegramId);
          setGeminiApiKey(loadedGeminiApiKey);
          
          if (loadedApiKey || loadedDatabaseId || loadedTelegramId || loadedGeminiApiKey) {
            setIsEditing(false);
          } else {
            setIsEditing(true);
          }

          if (onConfigLoaded) {
            onConfigLoaded(config);
          }
        } else {
          setGeminiApiKey(localGeminiKey);
          setIsEditing(true);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        setGeminiApiKey(localGeminiKey);
        setIsEditing(true);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setStatus(null);

    const cleanGeminiKey = geminiApiKey.trim();
    if (cleanGeminiKey) {
      localStorage.setItem('user_gemini_api_key', cleanGeminiKey);
    } else {
      localStorage.removeItem('user_gemini_api_key');
    }

    const configData: Partial<UserConfig> = {
      email: user?.email || '',
      displayName: user?.displayName || 'مستخدم تجريبي',
      telegramId: telegramId.trim(),
      geminiApiKey: cleanGeminiKey,
      notionCredentials: {
        apiKey: apiKey.trim(),
        databaseId: databaseId.trim()
      }
    };

    try {
      if (user) {
        await saveUserConfig(user.uid, configData);
      }
      setStatus({ type: 'success', text: 'تم حفظ المفتاح والإعدادات بنجاح! 🎉' });
      setIsEditing(false);
      if (onConfigLoaded) {
        onConfigLoaded({ uid: user?.uid || 'anonymous', ...configData } as UserConfig);
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setStatus({ type: 'success', text: 'تم حفظ مفتاح Gemini في متصفحك بنجاح! 🎉' });
      setIsEditing(false);
      if (onConfigLoaded) {
        onConfigLoaded({ uid: user?.uid || 'anonymous', ...configData } as UserConfig);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-right transition-all duration-300" dir="rtl" id="settings-panel">
      {!user && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-right flex items-start gap-2.5 text-xs text-amber-900" id="settings-guest-note">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">وضع الزائر:</span> يمكنك إضافة مفتاح Gemini API الخاص بك وتخزينه في متصفحك مباشرة. لحفظ إعدادات Notion وتلغرام بشكل دائم عبر السحابة، يرجى تسجيل الدخول.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="text-gray-500 animate-pulse">
            <Settings className="w-5 h-5 text-indigo-600" />
          </div>
          <h2 className="font-sans font-bold text-gray-900 text-base">إعدادات التكامل (Notion &amp; Telegram)</h2>
        </div>
        
        {/* Toggle Edit mode if previously saved successfully */}
        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setStatus(null); // Clear state messages on entering edit mode
            }}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 rounded-xl transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-100 active:scale-95"
            id="edit-settings-btn"
          >
            تعديل الحساب ✏️
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-sans">جاري تحميل إعداداتك...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 font-sans">
          
          {/* Notion API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-gray-400" />
                Notion API Key (رمز التكامل الداخلي)
              </label>
              {!isEditing && apiKey && (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-emerald-100 animate-fade-in">
                  ● متصل وآمن
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder={isEditing ? "secret_..." : "••••••••••••••••••••••••"}
              value={isEditing ? apiKey : (apiKey ? "••••••••••••••••••••••••" : "")}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={!isEditing}
              className={`w-full text-xs px-3 py-2 border rounded-xl focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-300 text-left ${
                !isEditing 
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed select-none' 
                  : 'border-gray-200 bg-white'
              }`}
              dir="ltr"
            />
            {isEditing && (
              <p className="text-[10px] text-gray-400 mt-1">
                يمكنك إنشاؤه من خلال زيارة <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">Notion My Integrations <ExternalLink className="w-2.5 h-2.5" /></a>
              </p>
            )}
          </div>

          {/* Notion Database ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-gray-400" />
                Notion Database ID (معرف قاعدة البيانات)
              </label>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors focus:outline-none"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showHelp ? 'إخفاء الدليل' : 'دليل التهيئة والجدول 💡'}
                </button>
              ) : (
                databaseId && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-emerald-100 animate-fade-in">
                    ● معرف نشط
                  </span>
                )
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. 1a2b3c4d5e6f..."
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              disabled={!isEditing}
              className={`w-full text-xs px-3 py-2 border rounded-xl focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-300 text-left ${
                !isEditing 
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed select-none' 
                  : 'border-gray-200 bg-white'
              }`}
              dir="ltr"
            />
            {isEditing && (
              <p className="text-[10px] text-gray-400 mt-1">
                المعرف المكون من 32 حرفاً الموجود في نهاية رابط قاعدة البيانات الخاصة بك في Notion. تأكد من مشاركة صفحتك مع التكامل (Connections).
              </p>
            )}

            {/* Notion Setup and Schema Help Section - Only visible during editing */}
            {isEditing && showHelp && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 text-right text-xs leading-relaxed text-gray-600 animate-fade-in" id="notion-help-card">
                <div className="flex items-center gap-2 text-indigo-950 font-bold">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>دليل مطابقة أعمدة ومفاتيح Notion Database</span>
                </div>
                
                <p className="text-[11px] text-gray-500">
                  حتى يتمكن تطبيق الذكاء الاصطناعي من تصدير التقارير الدراسية إلى صفحة Notion الخاصة بك بنجاح، يجب أن تحتوي قاعدة البيانات على الهيكل والمواصفات التالية بالضبط:
                </p>

                {/* Requirements Table */}
                <div className="bg-white rounded-lg border border-gray-100 p-2 overflow-x-auto">
                  <table className="w-full text-[10px] text-gray-600 border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="pb-1 text-right font-semibold">اسم العمود (Column Name)</th>
                        <th className="pb-1 text-right font-semibold">النوع في Notion (Type)</th>
                        <th className="pb-1 text-right font-semibold">الحالة (Status)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="py-1 font-mono font-bold text-indigo-600 text-[10px]">Name</td>
                        <td className="py-1">Title (العنوان الرئيسي للجدول)</td>
                        <td className="py-1 text-emerald-600 font-semibold">مطلوب (إجباري)</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-mono font-bold text-indigo-600 text-[10px]">URL</td>
                        <td className="py-1">URL (رابط ويب لتخزين الرابط)</td>
                        <td className="py-1 text-amber-600 font-semibold">موصى به (تلقائي)</td>
                      </tr>
                      <tr>
                        <td className="py-1 font-sans text-gray-500">محتوى التقرير الدراسّي</td>
                        <td className="py-1 text-gray-500">كتل الصفحة (Page Blocks)</td>
                        <td className="py-1 text-indigo-600 font-semibold">تلقائي (داخل الصفحة)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ASCII Diagram representation */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 block">شكل جدول قاعدة البيانات في حسابك (Visual Layout Preview):</span>
                  <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[9px] font-mono leading-tight tracking-wider text-left overflow-x-auto" dir="ltr">
{`┌───────────────────────────┬──────────────────────────────────┐
│ 🔤 Name (Title)           │ 🔗 URL (Url)                     │
├───────────────────────────┼──────────────────────────────────┤
│ عنوان الفيديو الملخص      │ https://youtube.com/watch?v=...  │
└───────────────────────────┴──────────────────────────────────┘
└─▶ [ملاحظة: الملخص المهيكل بالكامل يكتب تلقائياً بداخل الصفحة نفسها]`}
                  </pre>
                </div>

                {/* Example JSON payload Schema */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 block">مخطط الطلب البرمجي (Notion Pages API Payload):</span>
                  <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[9px] font-mono leading-tight text-left overflow-x-auto" dir="ltr">
{`{
  "parent": { "database_id": "YOUR_DATABASE_ID" },
  "properties": {
    "Name": {
      "title": [{ "text": { "content": "عنوان الفيديو الملخص" } }]
    },
    "URL": {
      "url": "https://youtube.com/..."
    }
  },
  "children": [ /* كتل المحتوى المنسقة تضاف تلقائياً هنا */ ]
}`}
                  </pre>
                </div>

                {/* Step-by-step Connection tip */}
                <div className="bg-indigo-50/50 rounded-lg p-2.5 border border-indigo-100/50 text-[10px] text-indigo-950 space-y-1.5">
                  <span className="font-bold flex items-center gap-1">💡 طريقة ربط قاعدة البيانات بالتكامل (Connections):</span>
                  <ol className="list-decimal list-inside space-y-1 text-gray-600">
                    <li>افتح صفحة قاعدة البيانات في حساب Notion الخاص بك.</li>
                    <li>انقر على زر الثلاث نقاط <strong className="font-bold">(•••)</strong> في أعلى الزاوية اليمنى.</li>
                    <li>اختر <strong className="font-bold">Add connections</strong> من القائمة المنسدلة.</li>
                    <li>ابحث عن اسم التكامل الذي أنشأته وحدده لمنحه صلاحية الكتابة والتعديل.</li>
                  </ol>
                </div>

              </div>
            )}
          </div>

          {/* Telegram User ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                معرف تلغرام (Telegram User ID)
              </label>
              {!isEditing && telegramId && (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-emerald-100 animate-fade-in">
                  ● البوت نشط
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. 987654321"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              disabled={!isEditing}
              className={`w-full text-xs px-3 py-2 border rounded-xl focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-300 text-left ${
                !isEditing 
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed select-none' 
                  : 'border-gray-200 bg-white'
              }`}
              dir="ltr"
            />

            {/* 1-Click Auto Link CTA */}
            {botInfo?.botUrl && user && (
              <a
                href={`${botInfo.botUrl}?start=link_${user.uid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 w-full py-2.5 px-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95 duration-150"
                id="telegram-one-click-link-btn"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>ربط أوتوماتيكي فوري للبوت (1-Click Auto Link)</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
              </a>
            )}

            {isEditing && (
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                اضغط على زر الربط الأوتوماتيكي أعلاه وسيفتح البوت ويقوم بضبط معرّفك وتوصيل حسابك فوراً دون الحاجة لكتابة أي شيء يدوياً.
              </p>
            )}
          </div>

          {/* Gemini Custom API Key (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                مفتاح Gemini API مخصص (اختياري / لتجنب قيود الطلبات)
              </label>
              {!isEditing && geminiApiKey && (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-emerald-100 animate-fade-in">
                  ● مفتاح مخصص مفعل
                </span>
              )}
            </div>
            <input
              type="password"
              placeholder={isEditing ? "AIzaSy..." : "••••••••••••••••••••••••"}
              value={isEditing ? geminiApiKey : (geminiApiKey ? "••••••••••••••••••••••••" : "")}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              disabled={!isEditing}
              className={`w-full text-xs px-3 py-2 border rounded-xl focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-300 text-left ${
                !isEditing 
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed select-none' 
                  : 'border-gray-200 bg-white'
              }`}
              dir="ltr"
            />
            {isEditing && (
              <p className="text-[10px] text-gray-450 mt-1 leading-relaxed">
                اختياري. في حال واجهت مشكلة "تم تجاوز الحد المسموح" (Quota Limit)، يمكنك إنشاء مفتاح مجاني خاص بك من <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-bold">Google AI Studio <ExternalLink className="w-2.5 h-2.5" /></a> ووضعه هنا ليتم استخدام حصتك الشخصية بدلاً من الحصة العامة المشتركة للموقع.
              </p>
            )}
          </div>

          {/* Status Message */}
          {status && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100 animate-fade-in' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{status.text}</span>
            </div>
          )}

          {/* Save Button - Only displayed during editing mode */}
          {isEditing && (
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95 duration-150"
              id="save-settings-btn"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  جاري حفظ البيانات...
                </>
              ) : (
                'حفظ التكوين والربط 💾'
              )}
            </button>
          )}

        </form>
      )}
    </div>
  );
}
