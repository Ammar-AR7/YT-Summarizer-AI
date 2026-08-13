import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { UserConfig, Summary, OutputFormat } from './types';
import Header from './components/Header';
import Hero from './components/Hero';
import NotionSettings from './components/NotionSettings';
import SummarizerForm from './components/SummarizerForm';
import CommunityFeed from './components/CommunityFeed';
import PersonalSummaries from './components/PersonalSummaries';
import SummaryViewer from './components/SummaryViewer';
import { Youtube, MessageSquare, ExternalLink, Bot, CheckCircle2, Library, BookOpen } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [activeSummary, setActiveSummary] = useState<{
    summary: string;
    videoTitle: string;
    videoId: string;
    summaryId: string;
    userId?: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [autoLoginStatus, setAutoLoginStatus] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<{ botUsername?: string; botUrl?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'community' | 'personal'>('community');

  // Fetch bot details dynamically with retry
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

  // Monitor auth state and handle automatic login via Telegram token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setAutoLoginStatus('جاري التحقق من هوية تلغرام والدخول التلقائي الآمن...');
      setAuthLoading(true);

      fetch('/api/auth/login-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const virtualUserObj = {
            uid: data.userId,
            email: data.userData.email || '',
            displayName: data.userData.displayName || 'مستخدم تلغرام',
            photoURL: null,
            isAnonymous: false,
            isVirtual: true
          } as unknown as User;

          // Clear any lingering standard sessions first
          localStorage.removeItem('virtualUser');
          localStorage.removeItem('virtualUserConfig');

          if (data.firebaseCustomToken) {
            import('firebase/auth').then(({ signInWithCustomToken }) => {
              signInWithCustomToken(auth, data.firebaseCustomToken)
              .then(() => {
                console.log('[Auto-Login] Firebase custom token login successful!');
                setUserConfig(data.userData);
                setAutoLoginStatus('تم تسجيل الدخول بنجاح عبر تلغرام! 🎉');
                setTimeout(() => setAutoLoginStatus(null), 3000);
              })
              .catch(err => {
                console.warn('[Auto-Login] Firebase custom token login failed, falling back to virtual session:', err);
                // Fallback to virtual user
                localStorage.setItem('virtualUser', JSON.stringify(virtualUserObj));
                localStorage.setItem('virtualUserConfig', JSON.stringify(data.userData));
                setUser(virtualUserObj);
                setUserConfig(data.userData);
                setAutoLoginStatus('تم تسجيل دخولك بنجاح في وضع الجلسة الآمنة! 🎉');
                setTimeout(() => setAutoLoginStatus(null), 3000);
              });
            });
          } else {
            // Fallback to virtual user directly
            localStorage.setItem('virtualUser', JSON.stringify(virtualUserObj));
            localStorage.setItem('virtualUserConfig', JSON.stringify(data.userData));
            setUser(virtualUserObj);
            setUserConfig(data.userData);
            setAutoLoginStatus('تم تسجيل دخولك بنجاح في وضع الجلسة الآمنة! 🎉');
            setTimeout(() => setAutoLoginStatus(null), 3000);
          }
          
          // Remove token from URL without refreshing the page
          const cleanUrl = window.location.pathname + (params.get('s') ? `?s=${params.get('s')}` : '');
          window.history.replaceState({}, document.title, cleanUrl);
        } else {
          console.error('[Auto-Login] Auto login failed:', data.error);
          const storedVirtualUser = localStorage.getItem('virtualUser');
          const storedVirtualConfig = localStorage.getItem('virtualUserConfig');
          if (storedVirtualUser && storedVirtualConfig) {
            setUser(JSON.parse(storedVirtualUser) as User);
            setUserConfig(JSON.parse(storedVirtualConfig) as UserConfig);
            setAutoLoginStatus('تم استرجاع الجلسة المحفوظة بنجاح 👌');
            setTimeout(() => setAutoLoginStatus(null), 3000);
          } else {
            setAutoLoginStatus(`فشل الدخول التلقائي: ${data.error}`);
            setTimeout(() => setAutoLoginStatus(null), 5000);
          }
          const cleanUrl = window.location.pathname + (params.get('s') ? `?s=${params.get('s')}` : '');
          window.history.replaceState({}, document.title, cleanUrl);
        }
      })
      .catch(err => {
        console.error('[Auto-Login] Error:', err);
        const storedVirtualUser = localStorage.getItem('virtualUser');
        const storedVirtualConfig = localStorage.getItem('virtualUserConfig');
        if (storedVirtualUser && storedVirtualConfig) {
          setUser(JSON.parse(storedVirtualUser) as User);
          setUserConfig(JSON.parse(storedVirtualConfig) as UserConfig);
        } else {
          setAutoLoginStatus('خطأ أثناء الاتصال بالخادم لإتمام الدخول التلقائي.');
          setTimeout(() => setAutoLoginStatus(null), 5000);
        }
        const cleanUrl = window.location.pathname + (params.get('s') ? `?s=${params.get('s')}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      })
      .finally(() => {
        setAuthLoading(false);
      });
    } else {
      // Check if there's an existing virtual session in localStorage
      const storedVirtualUser = localStorage.getItem('virtualUser');
      const storedVirtualConfig = localStorage.getItem('virtualUserConfig');
      if (storedVirtualUser && storedVirtualConfig) {
        setUser(JSON.parse(storedVirtualUser) as User);
        setUserConfig(JSON.parse(storedVirtualConfig) as UserConfig);
        setAuthLoading(false);
      } else {
        // Monitor standard auth state
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          // Only override if we don't have a virtual session
          if (!localStorage.getItem('virtualUser')) {
            setUser(currentUser);
            setAuthLoading(false);
            if (!currentUser) {
              setUserConfig(null);
              setActiveSummary(null);
            }
          }
        });
        return () => unsubscribe();
      }
    }
  }, []);

  // Auto-load summary if summary ID is specified in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const summaryIdParam = params.get('s') || params.get('summaryId');
    const autoPdfParam = params.get('autoPdf') === 'true';

    if (summaryIdParam) {
      import('./services/firebaseService').then(({ getSummaryById }) => {
        getSummaryById(summaryIdParam).then((sum) => {
          if (sum) {
            setActiveSummary({
              summary: sum.summaryText,
              videoTitle: sum.videoTitle,
              videoId: sum.videoId,
              summaryId: sum.id,
              userId: sum.userId
            });
            // Smooth scroll to summary view
            setTimeout(() => {
              const element = document.getElementById('active-summary-anchor');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }, 800);

            // Auto-trigger client-side PDF export with exact site styling
            if (autoPdfParam) {
              setTimeout(() => {
                import('./lib/pdfExport').then(({ downloadAsPdf }) => {
                  downloadAsPdf(
                    sum.videoTitle || 'ملخص دراسي',
                    sum.summaryText,
                    sum.videoId ? `https://www.youtube.com/watch?v=${sum.videoId}` : undefined
                  );
                });
              }, 1200);
            }
          }
        });
      });
    }
  }, []);

  const handleConfigLoaded = (config: UserConfig | null) => {
    setUserConfig(config);
  };

  const handleSummaryGenerated = (result: {
    summary: string;
    videoTitle: string;
    videoId: string;
    summaryId: string;
    format: OutputFormat;
  }) => {
    setActiveSummary({
      ...result,
      userId: user?.uid
    });
    // Increment trigger to refresh the community feed with the new summary!
    setRefreshTrigger((prev) => prev + 1);

    // If markdown is requested, automatically copy to clipboard
    if (result.format === 'markdown') {
      navigator.clipboard.writeText(result.summary)
        .then(() => {
          console.log('Successfully copied summary to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy text to clipboard:', err);
        });
    }

    // If docx/Word is requested, automatically trigger download
    if (result.format === 'docx') {
      import('./lib/wordExport').then(({ downloadAsWord }) => {
        downloadAsWord(
          result.videoTitle,
          result.summary,
          `https://www.youtube.com/watch?v=${result.videoId}`
        );
      });
    }

    // If PDF is requested, automatically trigger print/download
    if (result.format === 'pdf') {
      import('./lib/pdfExport').then(({ downloadAsPdf }) => {
        downloadAsPdf(
          result.videoTitle,
          result.summary,
          `https://www.youtube.com/watch?v=${result.videoId}`
        );
      });
    }
  };

  const handleSelectCommunitySummary = (summary: Summary) => {
    setActiveSummary({
      summary: summary.summaryText,
      videoTitle: summary.videoTitle,
      videoId: summary.videoId,
      summaryId: summary.id,
      userId: summary.userId
    });
    
    // Smooth scroll to summary view
    const element = document.getElementById('active-summary-anchor');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans" id="app-root">
      {/* Header component */}
      <Header user={user} loading={authLoading} userConfig={userConfig} />

      {/* Auto Login Banner */}
      {autoLoginStatus && (
        <div className="bg-indigo-600 text-white py-3 px-4 shadow-md transition-all animate-pulse text-center font-sans font-medium text-sm flex items-center justify-center gap-2" id="auto-login-banner" dir="rtl">
          <Bot className="w-5 h-5 shrink-0" />
          <span>{autoLoginStatus}</span>
        </div>
      )}

      {/* Hero Intro */}
      <Hero />

      {/* Main content grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-grow w-full overflow-x-hidden max-w-full">
        {/* Active generated/selected summary viewer - spans full width on computers for maximum visibility and clarity */}
        {activeSummary && (
          <div className="mb-8 w-full">
            {/* Anchor for active summary scroll */}
            <div id="active-summary-anchor" className="scroll-mt-20"></div>
            <SummaryViewer
              title={activeSummary.videoTitle}
              summaryText={activeSummary.summary}
              videoId={activeSummary.videoId}
              videoUrl={`https://www.youtube.com/watch?v=${activeSummary.videoId}`}
              summaryId={activeSummary.summaryId}
              ownerId={activeSummary.userId}
              currentUserId={user?.uid}
              onSummaryEdited={(newText) => {
                setActiveSummary(prev => prev ? { ...prev, summary: newText } : null);
                setRefreshTrigger(prev => prev + 1);
              }}
              notionCredentials={userConfig?.notionCredentials}
              onNotionCredentialsUpdated={(creds) => {
                setUserConfig(prev => prev ? { ...prev, notionCredentials: creds } : null);
              }}
              onClose={() => setActiveSummary(null)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          {/* RIGHT / MAIN COLUMN (2/3 width on large screens) */}
          <div className="lg:col-span-2 space-y-8 order-1 lg:order-1">
            
            {/* YouTube URL Summarizer Input Form */}
            <SummarizerForm 
              user={user} 
              userConfig={userConfig} 
              onSummaryGenerated={handleSummaryGenerated} 
            />

            {/* تبويبات: المجتمع و الملخصات الشخصية */}
            <div className="flex items-center gap-2 mb-4" dir="rtl">
              <button
                onClick={() => setActiveTab('community')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  activeTab === 'community'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Library className="w-4 h-4" />
                <span>المجتمع</span>
              </button>
              {user && (
                <button
                  onClick={() => setActiveTab('personal')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    activeTab === 'personal'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>ملخصاتي</span>
                </button>
              )}
            </div>

            {/* عرض التبويب النشط */}
            {activeTab === 'community' ? (
              <CommunityFeed 
                onSelectSummary={handleSelectCommunitySummary} 
                refreshTrigger={refreshTrigger} 
                user={user}
              />
            ) : user ? (
              <PersonalSummaries
                onSelectSummary={handleSelectCommunitySummary}
                refreshTrigger={refreshTrigger}
                user={user}
              />
            ) : null}

          </div>

          {/* LEFT COLUMN (1/3 width on large screens) */}
          <div className="lg:col-span-1 space-y-8 order-2 lg:order-2">
            
            {/* Notion & Telegram Settings configuration panel */}
            <NotionSettings 
              user={user} 
              userConfig={userConfig}
              onConfigLoaded={handleConfigLoaded} 
            />

            {/* Telegram Bot Instructions Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-right" dir="rtl" id="telegram-bot-info">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
                <div className="text-gray-500">
                  <Bot className="w-5 h-5 text-sky-500" />
                </div>
                <h3 className="font-sans font-bold text-gray-900 text-base">دليل تشغيل بوت تلغرام 🤖</h3>
              </div>

              <div className="space-y-4 text-xs text-gray-600 font-sans leading-relaxed">
                <p>
                  يمكنك الاستفادة من التلخيص السريع وحفظ الملاحظات مباشرة عبر إرسال روابط الفيديوهات إلى بوت تلغرام الذكي الخاص بنا دون الحاجة لفتح المتصفح!
                </p>

                {/* 1-Click Auto-Link CTA */}
                {user && botInfo?.botUrl && (
                  <a 
                    href={`${botInfo.botUrl}?start=link_${user.uid}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 duration-150"
                  >
                    <Bot className="w-4 h-4 shrink-0" />
                    <span>اضغط هنا لربط البوت بحسابك فوراً (1-Click Auto-Link)</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  </a>
                )}

                <ol className="space-y-2 list-decimal list-inside pr-2 text-right">
                  <li>
                    افتح البوت مباشرة في تلغرام:{' '}
                    <a 
                      href={botInfo?.botUrl || "https://t.me/YouTube_Notion_LMS_bot"} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      @{botInfo?.botUsername || "YouTube_Notion_LMS_bot"} <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    أو ابحث عنه بالاسم لبدء الاستخدام.
                  </li>
                  <li>
                    أرسل الأمر <code className="bg-gray-100 text-indigo-600 px-1 py-0.5 rounded font-mono">/start</code> للبوت.
                  </li>
                  <li>
                    سيقوم البوت بالرد فوراً والتأكد من ربط حسابك أوتوماتيكياً.
                  </li>
                  <li>
                    الآن ببساطة أرسل أي رابط فيديو يوتيوب للبوت، وسيرسل الملخص مهيكلاً مباشرة إلى Notion أو يتيح لك تنزيله كـ Word / PDF!
                  </li>
                </ol>

                <div className="p-3 bg-indigo-50/50 rounded-xl text-[11px] text-indigo-800 border border-indigo-100/50 flex gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                  <span>تلميح: يتم ربط المعرفات بشكل آمن بالكامل على قاعدة بيانات Firestore لإبقاء معلوماتك سرية.</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400 font-sans mt-12">
        <p dir="rtl">
          مدعوم بتقنيات Gemini AI و Firebase 🔥
        </p>
      </footer>
    </div>
  );
}
