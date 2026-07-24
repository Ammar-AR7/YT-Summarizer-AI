import React, { useState } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  User 
} from 'firebase/auth';
import { Youtube, LogOut, ShieldCheck, UserCheck, Link, CheckCircle2, XCircle, Send, Key, FileText, ChevronDown } from 'lucide-react';
import { UserConfig } from '../types';

interface HeaderProps {
  user: User | null;
  loading: boolean;
  userConfig?: UserConfig | null;
}

export default function Header({ user, loading, userConfig }: HeaderProps) {
  const [showStatusDetails, setShowStatusDetails] = useState(false);

  const isNotionLinked = !!(userConfig?.notionCredentials?.apiKey && userConfig?.notionCredentials?.databaseId);
  const isTelegramLinked = !!userConfig?.telegramId && userConfig.telegramId.trim().length > 0;
  const hasCustomGeminiKey = !!userConfig?.geminiApiKey && userConfig.geminiApiKey.trim().length > 0;

  const scrollToSettings = () => {
    const element = document.getElementById('notion-settings-card');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      alert('تم حظر النافذة المنبثقة من قبل متصفحك. يرجى تجربة وضع التجربة السريعة (Guest Mode) للوصول الفوري.');
    }
  };

  const handleGuestSignIn = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('virtualUser');
    localStorage.removeItem('virtualUserConfig');
    signOut(auth)
      .then(() => {
        window.location.reload();
      })
      .catch(err => {
        console.error(err);
        window.location.reload();
      });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100/90 shadow-2xs" id="app-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        
        {/* Logo and Title */}
        <div className="flex items-center space-x-2 space-x-reverse shrink-0">
          <div className="bg-indigo-600 text-white p-1.5 sm:p-2 rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center">
            <Youtube className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <span className="font-sans font-bold text-sm sm:text-lg tracking-tight text-gray-900">
            YT-Summarizer <span className="text-indigo-600 font-black italic text-2xs sm:text-sm px-1.5 py-0.5 bg-indigo-50 rounded-md">AI</span>
          </span>
        </div>

        {/* Auth / Profile & Account Link Indicator Area */}
        <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse min-w-0">
          
          {/* Real-time Account Link Status Indicator */}
          {user && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowStatusDetails(!showStatusDetails)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full border border-gray-200/90 bg-white hover:bg-gray-50 text-xs font-sans transition-all shadow-2xs"
                title="انقر لمعاينة حالة ربط حسابات Notion وتلغرام"
                id="account-link-status-btn"
              >
                <Link className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold text-gray-700 hidden md:inline">حالة الربط:</span>
                
                {/* Notion Badge */}
                <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] ${isNotionLinked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  <FileText className="w-2.5 h-2.5" />
                  Notion: {isNotionLinked ? 'مرتبط' : 'غير مرتبط'}
                </span>

                {/* Telegram Badge */}
                <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] ${isTelegramLinked ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                  <Send className="w-2.5 h-2.5" />
                  تلغرام: {isTelegramLinked ? 'مرتبط' : 'غير مرتبط'}
                </span>

                {/* Mobile compact indicator */}
                <span className="sm:hidden font-semibold text-[11px] text-gray-700">الربط</span>

                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showStatusDetails ? 'rotate-180' : ''}`} />
              </button>

              {/* Real-time Status Popover Dropdown */}
              {showStatusDetails && (
                <div 
                  className="fixed top-16 left-3 right-3 sm:absolute sm:top-full sm:left-auto sm:right-0 sm:w-80 sm:mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 text-right font-sans animate-in fade-in zoom-in-95 duration-150" 
                  dir="rtl" 
                  id="account-link-popover"
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
                    <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-indigo-600" />
                      مؤشر تشخيص وتتبع ربط الحساب
                    </h4>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">تحديث فوري</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Notion Integration Status */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800">حساب Notion</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {isNotionLinked ? 'رمز API ومعرّف القاعدة مكتملين' : 'لم يتم ربط مفتاح API وقاعدة البيانات'}
                          </p>
                        </div>
                      </div>
                      {isNotionLinked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </div>

                    {/* Telegram Integration Status */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-sky-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800">حساب تلغرام</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {isTelegramLinked ? `معرّف: ${userConfig?.telegramId}` : 'لم يتم ربط البوت بحسابك'}
                          </p>
                        </div>
                      </div>
                      {isTelegramLinked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                    </div>

                    {/* Gemini API Key Status */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800">مفتاح Gemini API</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {hasCustomGeminiKey ? 'مفتاحك الشخصي مفعّل' : 'المفتاح العام الافتراضي'}
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowStatusDetails(false);
                      scrollToSettings();
                    }}
                    className="w-full mt-3 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs text-center block"
                  >
                    إدارة إعدادات الربط والربط المباشر ⚙️
                  </button>

                  {/* Sign Out Button for Mobile Inside Popover */}
                  <button
                    onClick={() => {
                      setShowStatusDetails(false);
                      handleSignOut();
                    }}
                    className="w-full mt-2 min-h-[44px] py-2.5 px-3 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5 sm:hidden cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل الخروج من الحساب
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="w-7 h-7 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0"></div>
          ) : user ? (
            <div className="flex items-center space-x-1 sm:space-x-2 space-x-reverse shrink-0 min-w-0">
              {/* Profile Card */}
              <div className="flex items-center bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-gray-200/80 min-w-0 gap-1.5">
                {user.isAnonymous ? (
                  <div className="hidden sm:flex w-6 h-6 rounded-full bg-amber-500 text-white text-xs items-center justify-center font-bold shrink-0">
                    T
                  </div>
                ) : user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="hidden sm:block w-6 h-6 rounded-full referrer-no-referrer shrink-0 m-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="hidden sm:flex w-6 h-6 rounded-full bg-indigo-600 text-white text-xs items-center justify-center font-bold shrink-0">
                    {(user.displayName?.slice(0, 1) || user.email?.slice(0, 1) || 'U').toUpperCase()}
                  </div>
                )}
                
                <span 
                  className="text-[10px] sm:text-xs font-semibold text-gray-800 max-w-[70px] xs:max-w-[100px] sm:max-w-[150px] md:max-w-[200px] truncate leading-tight"
                  title={user.displayName || user.email || ''}
                >
                  {user.isAnonymous ? 'زائر' : (user.displayName || user.email?.split('@')[0] || user.email)}
                </span>

                {user.isAnonymous ? (
                  <span className="hidden sm:inline-flex bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md items-center gap-1 shrink-0">
                    <UserCheck className="w-3 h-3" /> تجريبي
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded-md items-center gap-1 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> موثق
                  </span>
                )}
              </div>

              {/* Logout Button - Hidden on Mobile per request */}
              <button 
                onClick={handleSignOut}
                className="hidden sm:flex p-1.5 sm:p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shrink-0"
                title="تسجيل الخروج"
                id="sign-out-btn"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 sm:space-x-2 space-x-reverse shrink-0">
              {/* Guest Login */}
              <button
                onClick={handleGuestSignIn}
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all shadow-2xs"
                id="guest-login-btn"
              >
                تجربة سريعة ⚡
              </button>

              {/* Google Login */}
              <button
                onClick={handleGoogleSignIn}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5"
                id="google-login-btn"
              >
                <span>Google</span>
                <span className="hidden sm:inline">الدخول بواسطة</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
