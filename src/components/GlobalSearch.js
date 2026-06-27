import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

const STATUS_AR = {
  registered:                       'مسجل',
  pending_payment:                  'انتظار دفع',
  waiting:                          'انتظار الطبيب',
  with_doctor:                      'مع الطبيب',
  awaiting_service_payment:         'انتظار دفع خدمات',
  completed_admin_pending_services: 'خدمات معلقة',
  completed:                        'مكتمل',
  cancelled:                        'ملغي',
};

const GlobalSearch = () => {
  const { token } = useAuthStore();
  const navigate  = useNavigate();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer    = useRef(null);

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length >= 2) {
      timer.current = setTimeout(() => search(query), 350);
    } else {
      setResults([]);
    }
  }, [query, search]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (item) => {
    navigate(`/secretary/patients`);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors text-sm min-w-[180px] border border-gray-200"
      >
        <Search size={15}/>
        <span className="flex-1 text-right text-gray-400">بحث سريع...</span>
        <span className="text-xs text-gray-300 font-mono bg-gray-200 px-1.5 py-0.5 rounded">Ctrl K</span>
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4" dir="rtl">
            {/* Backdrop */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { setOpen(false); setQuery(''); }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity:0, y:-20, scale:0.96 }}
              animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, y:-10, scale:0.96 }}
              transition={{ type:'spring', stiffness:400, damping:30 }}
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <Search size={18} className="text-gray-400 flex-shrink-0"/>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="ابحث بالاسم، رقم الهاتف، رقم الزيارة..."
                  className="flex-1 outline-none text-gray-800 text-sm placeholder:text-gray-400"
                  autoComplete="off"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setResults([]); }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X size={15}/>
                  </button>
                )}
                {loading && <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin flex-shrink-0"/>}
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 && query.trim().length >= 2 && !loading ? (
                  <div className="text-center py-10 text-gray-400 text-sm">لا توجد نتائج</div>
                ) : results.map((r, i) => (
                  <motion.button key={r.id || i}
                    initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-right border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {r.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm">{r.full_name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Hash size={10}/> {r.visit_number || '—'}
                        </span>
                        {r.phone && <span className="flex items-center gap-1 text-xs text-gray-400">{r.phone}</span>}
                        {r.age && <span className="text-xs text-gray-400">{r.age} سنة</span>}
                      </div>
                    </div>
                    {r.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0">
                        {STATUS_AR[r.status] || r.status}
                      </span>
                    )}
                  </motion.button>
                ))}

                {!query && (
                  <div className="text-center py-8 text-gray-400">
                    <Search size={28} className="mx-auto mb-2 opacity-20"/>
                    <p className="text-sm">ابدأ الكتابة للبحث</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalSearch;
