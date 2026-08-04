import React, { useState, useEffect } from 'react';
import { getPublicSummaries, deleteSummary } from '../services/firebaseService';
import { Summary } from '../types';
import { Library, Eye, Clock, User, Youtube, Trash2, Search, Filter, ChevronRight, ChevronLeft, Tag } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface CommunityFeedProps {
  onSelectSummary: (summary: Summary) => void;
  refreshTrigger?: number;
  user?: FirebaseUser | null;
}

export default function CommunityFeed({ onSelectSummary, refreshTrigger, user }: CommunityFeedProps) {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mine' | 'newest' | 'oldest'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const handleConfirmDelete = async (summaryId: string) => {
    try {
      await deleteSummary(summaryId, user);
      setSummaries((prev) => prev.filter((s) => s.id !== summaryId));
    } catch (err) {
      console.error('Failed to delete summary:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // فحص صلاحيات الأدمن عند تغيير المستخدم
  useEffect(() => {
    if (user?.email) {
      fetch(`/api/admin/check?email=${encodeURIComponent(user.email)}`)
        .then(r => r.json())
        .then(d => setIsAdmin(!!d.isAdmin))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const feed = await getPublicSummaries();
        setSummaries(feed);
      } catch (err) {
        console.error('Failed to load feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [refreshTrigger]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'حديثاً';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'حديثاً';
    }
  };

  // Filter & Search Logic
  const filteredSummaries = summaries.filter((item) => {
    // 1. My Summaries filter
    if (filterType === 'mine') {
      if (!user || item.userId !== user.uid) return false;
    }

    // 2. Search query filter (title, user name, or summary text)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (item.videoTitle || '').toLowerCase().includes(q);
      const userMatch = (item.userDisplayName || '').toLowerCase().includes(q);
      const contentMatch = (item.summaryText || '').toLowerCase().includes(q);
      if (!titleMatch && !userMatch && !contentMatch) return false;
    }

    return true;
  }).sort((a, b) => {
    if (filterType === 'oldest') {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    }
    // Default: newest
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredSummaries.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSummaries = filteredSummaries.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 text-right overflow-x-hidden max-w-full w-full" dir="rtl" id="community-feed">
      {/* Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-gray-900 text-base">Community Suggestions</h2>
            <p className="text-[11px] text-gray-400 font-sans mt-0.5">تصفح وابحث في أرشيف الملخصات العامة لتوليدات المجتمع مع إمكانية الفلترة والبحث السريع.</p>
          </div>
        </div>

        {/* Count Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-600 self-start sm:self-auto">
          <Tag className="w-3.5 h-3.5 text-indigo-600" />
          <span>إجمالي الملخصات: {filteredSummaries.length}</span>
        </div>
      </div>

      {/* Search Bar & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-6">
        {/* Search Input */}
        <div className="sm:col-span-7 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الفيديو، اسم المستخدم، أو الكلمات المفتاحية..."
            className="w-full text-xs pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-600 focus:outline-none transition-all placeholder:text-gray-400 font-sans"
            id="community-search-input"
          />
          <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
        </div>

        {/* Filter Buttons */}
        <div className="sm:col-span-5 flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'newest', label: 'الأحدث' },
            { id: 'oldest', label: 'الأقدم' },
            ...(user ? [{ id: 'mine', label: 'ملخصاتي' }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-400 font-sans">جاري جلب النماذج والملخصات العامة...</span>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="py-16 text-center text-gray-400 font-sans border-2 border-dashed border-gray-100 rounded-2xl">
          <Youtube className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-xs font-medium text-gray-600 mb-1">لم يتم العثور على ملخصات تطابق البحث!</p>
          <p className="text-[11px] text-gray-400">جرب البحث بكلمات مختلفة أو تغيير إعدادات الفلترة.</p>
        </div>
      ) : (
        <>
          {/* 6 Grid Items Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-full">
            {paginatedSummaries.map((summary) => (
              <div
                key={summary.id}
                onClick={() => onSelectSummary(summary)}
                className="group cursor-pointer bg-gray-50 hover:bg-white hover:ring-2 hover:ring-indigo-100 border border-gray-100 hover:border-indigo-200 rounded-2xl overflow-hidden transition-all flex flex-col justify-between w-full max-w-full"
                id={`summary-card-${summary.id}`}
              >
                {/* Card Thumbnail & Details */}
                <div className="p-3.5 sm:p-4 flex gap-3 sm:gap-4 items-start w-full max-w-full min-w-0">
                  {/* Youtube Video Thumbnail */}
                  <div className="relative w-24 sm:w-28 shrink-0 aspect-video rounded-xl overflow-hidden bg-gray-200 border border-gray-100">
                    <img
                      src={`https://img.youtube.com/vi/${summary.videoId}/mqdefault.jpg`}
                      alt={summary.videoTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all referrer-no-referrer"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as any).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-all">
                      <Youtube className="w-6 h-6 text-indigo-600 bg-white rounded-full p-1 shadow-md" />
                    </div>
                  </div>

                  {/* Info Text */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="font-sans font-bold text-xs sm:text-sm text-gray-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors break-words [overflow-wrap:anywhere]">
                      {summary.videoTitle}
                    </h3>
                    
                    {/* Author Meta */}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-sans">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">بواسطة: {summary.userDisplayName}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Bar */}
                <div 
                  className="px-4 py-2 border-t border-gray-100/50 bg-gray-50/50 flex items-center justify-between text-[10px] text-gray-400 font-sans"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(summary.createdAt)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {user && (isAdmin || summary.userId === user.uid) && (
                      <div className="flex items-center">
                        {deletingId === summary.id ? (
                          <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">
                            <button
                              onClick={() => handleConfirmDelete(summary.id)}
                              className="font-bold hover:underline cursor-pointer font-sans"
                            >
                              نعم، احذف
                            </button>
                            <span className="text-red-200">|</span>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="hover:underline text-gray-500 cursor-pointer font-sans"
                            >
                              تراجع
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(summary.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer font-sans"
                            title="حذف الملخص"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div 
                      onClick={() => onSelectSummary(summary)}
                      className="flex items-center gap-1 text-indigo-600 font-bold hover:underline cursor-pointer font-sans"
                    >
                      <span>تصفح الملخص الأكاديمي</span>
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-gray-600">
              <span className="text-[11px] text-gray-400">
                عرض {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredSummaries.length)} من إجمالي {filteredSummaries.length} ملخص
              </span>

              <div className="flex items-center gap-1.5" dir="ltr">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>السابق</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                  <span>التالي</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
