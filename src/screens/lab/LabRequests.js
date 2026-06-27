import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Search, Clock, Check, RefreshCcw, X, Upload, CheckCircle,
  TrendingUp, Calendar, AlertCircle, LayoutGrid, List, Maximize2, Minimize2, ChevronDown, Activity, ImageIcon, Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { getSocket } from '../../utils/socket';

// ── Upload Result Modal ───────────────────────────────────────────
const UploadResultModal = ({ request, onClose, onUploaded, token }) => {
  const [fileBase64, setFileBase64] = useState(null);
  const [fileName, setFileName]     = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const fileInputRef = useRef(null);

  // Initialize if editing
  useEffect(() => {
    if (request.result_notes) setNotes(request.result_notes);
  }, [request]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return toast.error('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت.');
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setFileBase64(reader.result);
    reader.onerror = () => toast.error('فشل قراءة الملف');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lab/request/${request.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resultFile: fileBase64, resultNotes: notes })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        onUploaded();
        onClose();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('فشل الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-inner">
              <Activity size={20} />
            </div>
            <h3 className="font-black text-gray-800 text-lg">تسجيل النتيجة المخبرية</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <div className="mb-5 bg-gradient-to-r from-orange-50 to-orange-50 p-4 rounded-2xl border border-orange-100/50 shadow-sm">
          <p className="font-black text-orange-900 text-sm mb-1">{request.name}</p>
          {request.category_name && <p className="text-xs font-bold text-orange-600/70">{request.category_name}</p>}
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">النتيجة المخبرية (ملاحظات)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="اكتب القيم أو النتيجة التفصيلية هنا..." className="input-base text-sm resize-none w-full bg-gray-50 focus:bg-white" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">إرفاق تقرير الجهاز (اختياري)</label>
            <div className="flex items-center gap-3">
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,image/*" />
              <button onClick={() => fileInputRef.current.click()}
                className="flex-1 py-3 rounded-2xl border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center justify-center gap-2 text-gray-600 text-sm font-bold">
                <Upload size={18} className={fileName ? "text-orange-500" : "text-gray-400"} /> 
                {fileName || 'اضغط لاختيار ملف'}
              </button>
              {fileBase64 && (
                <button onClick={() => { setFileBase64(null); setFileName(''); }} className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-colors">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <p className="text-[10px] font-bold text-gray-400 mt-2 text-center">يدعم PDF والصور (الحد الأقصى 5MB)</p>
          </div>
        </div>

        <div className="flex gap-3 mt-7">
          <button onClick={handleSave} disabled={saving} className="btn-primary bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 border-none flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl">
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <CheckCircle size={18} />}
            حفظ النتيجة
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Patient Detail Modal (Fullscreen Mega Modal) ──────────────────
const PatientDetailModal = ({ visitId, token, onClose, onCompleted }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingRequest, setUploadingRequest] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab/visit/${visitId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      setData(d);
    } catch { toast.error('فشل تحميل التفاصيل'); }
    finally { setLoading(false); }
  }, [visitId, token]);

  useEffect(() => { load(); }, [load]);

  const handleStartRequest = async (id) => {
    try {
      await fetch(`/api/lab/request/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in_progress' })
      });
      load();
      onClose(); // Automatically close the modal when confirming start execution
    } catch { toast.error('فشل بدء التنفيذ'); }
  };

  const handleFinishPatient = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/lab/visit/${visitId}/complete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onCompleted();
        onClose();
      } else toast.error(d.message);
    } catch { toast.error('تعذر الاتصال'); }
    finally { setCompleting(false); }
  };

  const isAllDone = data?.requests?.every(r => r.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`relative z-10 bg-gray-50 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen ? 'w-full h-full rounded-none sm:rounded-3xl' : 'w-full max-w-4xl h-[85vh] rounded-3xl'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0 relative z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-200 font-bold text-xl">
              {data?.visit?.full_name?.charAt(0) || <FlaskConical size={24} />}
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg sm:text-xl">
                {data?.visit?.full_name || 'جاري تحميل بيانات المريض...'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">المعرف: {data?.visit?.visit_number}</span>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">العمر: {data?.visit?.age} سنة</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 mr-4 hidden sm:flex">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutGrid size={16} />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}>
                <List size={16} />
              </button>
            </div>
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors hidden sm:block">
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={onClose} className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200/50 rounded-3xl animate-pulse" />)}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Medical Alerts */}
              {(data.visit.allergies || data.visit.chronic_diseases) && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-5 shadow-sm flex items-start gap-4">
                  <div className="bg-amber-100 text-amber-600 p-2 rounded-xl mt-1">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-amber-800 text-sm mb-2">تنبيهات طبية هامة</h4>
                    <div className="flex flex-col gap-1 text-sm font-bold text-amber-700/80">
                      {data.visit.allergies && <p><span className="text-amber-900">حساسية:</span> {data.visit.allergies}</p>}
                      {data.visit.chronic_diseases && <p><span className="text-amber-900">أمراض مزمنة:</span> {data.visit.chronic_diseases}</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                  <FlaskConical size={20} className="text-orange-500" />
                  قائمة العينات والفحوصات المطلوبة
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-sm">{data.requests?.length || 0}</span>
                </h3>
              </div>

              {/* Requests Grid/List */}
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                {data.requests?.map(req => (
                  <div key={req.id} className={`p-5 rounded-3xl border-2 transition-all duration-300 relative overflow-hidden group bg-white shadow-sm hover:shadow-md ${
                    req.status === 'completed' ? 'border-emerald-100 hover:border-emerald-300' :
                    req.status === 'in_progress' ? 'border-blue-100 hover:border-blue-300' : 
                    'border-gray-100 hover:border-gray-300'
                  }`}>
                    {/* Status Indicator Line */}
                    <div className={`absolute top-0 right-0 bottom-0 w-1.5 ${
                      req.status === 'completed' ? 'bg-emerald-400' :
                      req.status === 'in_progress' ? 'bg-blue-400' : 'bg-gray-300'
                    }`} />
                    
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-black text-gray-800 text-base">{req.name}</h4>
                        {req.category_name && <p className="text-xs font-bold text-gray-400 mt-1">{req.category_name}</p>}
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                        req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        req.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {req.status === 'completed' ? <CheckCircle size={12}/> : req.status === 'in_progress' ? <RefreshCcw size={12} className="animate-spin-slow"/> : <Clock size={12}/>}
                        {req.status === 'completed' ? 'تم الفحص' : req.status === 'in_progress' ? 'قيد العمل' : 'بانتظار العينة'}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      {/* Action Buttons */}
                      <div className="w-full">
                        {req.status === 'paid' && (
                          <button onClick={() => handleStartRequest(req.id)}
                            className="w-full py-2.5 text-xs font-black bg-gray-50 text-gray-700 border border-gray-200 rounded-xl hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                            <FlaskConical size={14} /> استلام العينة وبدء الفحص
                          </button>
                        )}
                        {req.status === 'in_progress' && (
                          <button onClick={() => setUploadingRequest(req)}
                            className="w-full py-2.5 text-xs font-black bg-orange-600 text-white shadow-md shadow-orange-200 rounded-xl hover:bg-orange-700 transition-all flex items-center justify-center gap-2">
                            <CheckCircle size={14} /> تسجيل النتيجة المخبرية
                          </button>
                        )}
                        {req.status === 'completed' && (
                          <div className="flex flex-col gap-2">
                            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2 text-xs font-bold text-gray-600">
                              {req.result_notes && (
                                <div className="flex items-start gap-2">
                                  <span className="text-gray-400 w-12 flex-shrink-0">النتيجة:</span>
                                  <span className="text-gray-800 break-words">{req.result_notes}</span>
                                </div>
                              )}
                              {req.result_file && (
                                <div className="flex items-center gap-2 text-blue-600">
                                  <span className="text-gray-400 w-12 flex-shrink-0">مرفق:</span>
                                  <span className="bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                                    <ImageIcon size={12} /> تقرير إلكتروني
                                  </span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => setUploadingRequest(req)} className="text-xs font-bold text-gray-400 hover:text-orange-600 self-end transition-colors">
                              تعديل النتيجة
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-white border-t border-gray-100 flex-shrink-0 z-20 flex justify-end items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="w-full max-w-sm ml-auto">
            <button onClick={handleFinishPatient} disabled={completing || loading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm transition-all duration-300 ${
                isAllDone 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}>
              {completing ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <CheckCircle size={20} />}
              {isAllDone ? 'إرسال النتائج النهائية للطبيب وإنهاء' : 'يُرجى تسجيل كافة النتائج أولاً'}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {uploadingRequest && (
          <UploadResultModal request={uploadingRequest} token={token}
            onClose={() => setUploadingRequest(null)} onUploaded={load} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Reports Tab (Statistics and Consumption Logs) ─────────────────
const ReportsPanel = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/lab/stats?';
      
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `startDate=${customRange.start}&endDate=${customRange.end}`;
      } else if (dateFilter !== 'all') {
        const now = new Date();
        let start = '';
        const pad = (n) => n.toString().padStart(2, '0');
        const format = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        
        if (dateFilter === 'today') {
          start = format(now);
        } else if (dateFilter === 'week') {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          start = format(past);
        } else if (dateFilter === 'month') {
          const past = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          start = format(past);
        }
        url += `startDate=${start}&endDate=${format(now)}`;
      }

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
      setStats(await res.json());
    } catch { 
      toast.error('فشل تحميل الإحصائيات'); 
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleResetFilters = () => {
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    toast.info('تم إعادة تعيين فلاتر التقارير');
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 w-full custom-scrollbar pr-2 pb-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-orange-900 to-orange-900 p-6 rounded-3xl text-white border border-orange-950 shadow-lg relative overflow-hidden flex-shrink-0 mt-2">
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-orange-200 shadow-inner backdrop-blur-sm">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">تقارير وإحصائيات المختبر التحليلية</h1>
              <p className="text-orange-200/70 text-xs mt-1 font-bold">تتبع الأداء، عدد العينات، وحالة الفحوصات المنجزة</p>
            </div>
          </div>
          <button onClick={fetchStats} className="btn-secondary bg-black/20 hover:bg-black/30 border-none text-white flex items-center gap-2 text-xs font-bold py-2 shadow-md transition-colors rounded-xl px-4">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> تحديث البيانات
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-bold text-gray-500">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'آخر 7 أيام' },
              { id: 'month', label: 'آخر 30 يوماً' },
              { id: 'custom', label: 'تاريخ مخصص' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  dateFilter === f.id ? 'bg-white text-orange-800 shadow-sm' : 'hover:bg-white/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter !== 'all' && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
            >
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Custom Range Picker */}
        <AnimatePresence>
          {dateFilter === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">من تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* KPI Overviews */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-shrink-0">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-orange-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">إجمالي الفحوصات المطلوبة</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.total_requests || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner"><FlaskConical size={20} /></div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">الفحوصات المنجزة (النتائج مسجلة)</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.completed || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><CheckCircle size={20} /></div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-orange-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">الفحوصات قيد العمل / المعلقة</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.pending || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner"><Clock size={20} /></div>
            </div>
          </div>

          {/* Table Data Render with Accordion */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-shrink-0">
            <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center gap-2">
              <FlaskConical size={18} className="text-gray-400" />
              <h4 className="font-black text-gray-700 text-sm">سجل المرضى والفحوصات المخبرية</h4>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-150 text-xs font-bold">
                  <tr>
                    <th className="px-5 py-3">المعرف (الرقم المرجعي)</th>
                    <th className="px-5 py-3">اسم المريض</th>
                    <th className="px-5 py-3">إجمالي الفحوصات</th>
                    <th className="px-5 py-3">الفحوصات المنجزة</th>
                    <th className="px-5 py-3">آخر تحديث للنتائج</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(!stats?.tableData || stats.tableData.length === 0) ? (
                    <tr>
                      <td colSpan="6" className="p-10 text-center text-gray-400 font-bold text-xs">لا يوجد بيانات في هذه الفترة.</td>
                    </tr>
                  ) : (
                    stats.tableData.map((row, i) => {
                      const isExpanded = expandedRow === row.visit_number;
                      return (
                        <React.Fragment key={row.visit_number}>
                          <tr 
                            onClick={() => setExpandedRow(isExpanded ? null : row.visit_number)}
                            className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer group"
                          >
                            <td className="px-5 py-4 font-black text-gray-500 text-xs bg-gray-50/50">{row.visit_number}</td>
                            <td className="px-5 py-4 font-extrabold text-gray-800">{row.patient_name}</td>
                            <td className="px-5 py-4 font-black text-gray-700">
                              {row.total_tests} <span className="text-gray-400 font-bold text-[10px]">فحوصات</span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${
                                row.completed_tests === row.total_tests 
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                  : row.completed_tests > 0 
                                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}>
                                {row.completed_tests} / {row.total_tests} مكتمل
                              </span>
                            </td>
                            <td className="px-5 py-4 font-bold text-gray-500 text-xs" dir="ltr">
                              {new Date(row.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                                <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          <AnimatePresence>
                            {isExpanded && (
                              <tr className="bg-gray-50/30">
                                <td colSpan="6" className="p-0 border-b border-gray-100">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-6">
                                      <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm space-y-3">
                                        <h5 className="font-black text-gray-700 text-sm mb-3">تفاصيل الفحوصات المخبرية المدرجة:</h5>
                                        <div className="flex flex-wrap gap-2">
                                          {row.tests_names?.split(' - ').map((name, nIdx) => (
                                            <span key={nIdx} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 shadow-sm flex items-center gap-1.5">
                                              <FlaskConical size={12} className="text-orange-400" />
                                              {name.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Dashboard (Sidebar Navigation replaces Tabs) ─────────────
const LabRequests = ({ tab = 'pending' }) => {
  const { token } = useAuthStore();
  const activeTab = tab; // using prop instead of internal state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery]       = useState('');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/lab/requests?tab=${activeTab}`;
      if (activeTab === 'completed') {
        const today = new Date().toISOString().split('T')[0];
        url += `&startDate=${today}&endDate=${today}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل القائمة'); }
    finally { setLoading(false); }
  }, [token, activeTab]);

  useEffect(() => {
    fetchRequests();
    const socket = getSocket();
    const handleUpdate = () => fetchRequests();
    socket.on('request:new', handleUpdate);
    socket.on('lab:update', handleUpdate);
    return () => {
      socket.off('request:new', handleUpdate);
      socket.off('lab:update', handleUpdate);
    };
  }, [fetchRequests]);

  const filtered = requests.filter(r => 
    !query || r.full_name.includes(query) || r.visit_number.includes(query)
  );

  return (
    <div className="flex gap-4 h-full" dir="rtl">
      {activeTab === 'reports' ? (
        <ReportsPanel token={token} />
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-5 flex-shrink-0 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <FlaskConical size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black text-gray-900">
                  {activeTab === 'pending' && "قائمة العينات والفحوصات المطلوبة"}
                  {activeTab === 'in_progress' && "التحاليل قيد الإجراء"}
                  {activeTab === 'completed' && "التحاليل المنجزة"}
                </h1>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  {requests.length} مريض
                  {activeTab === 'pending' ? ' بانتظار التحاليل' : activeTab === 'in_progress' ? ' قيد الفحص' : ' تمت فحوصاتهم'}
                </p>
              </div>
            </div>
            <button onClick={fetchRequests} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm bg-gray-50 border-none shadow-sm hover:bg-gray-100 px-4 py-2 rounded-xl">
              <RefreshCcw size={16} className={loading ? 'animate-spin text-orange-600' : 'text-orange-600'} /> تحديث
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-5 flex-shrink-0">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              className="input-base pr-11 text-sm w-full max-w-md bg-white border-gray-100 shadow-sm rounded-2xl h-12 focus:border-orange-300 focus:ring-4 focus:ring-orange-50" 
              placeholder="ابحث باسم المريض أو المعرف..." />
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 pb-4">
            {loading ? [1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-3xl animate-pulse" />)
            : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                <FlaskConical size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-bold">لا توجد طلبات معلقة</p>
              </div>
            ) : filtered.map((v, i) => {
              const isActive = selected?.visit_id === v.visit_id;
              return (
                <motion.div key={v.visit_id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelected(isActive ? null : v)}
                  className={`bg-white rounded-3xl border-2 cursor-pointer p-5 transition-all duration-300 ${
                    isActive ? 'border-orange-400 shadow-lg shadow-orange-100 ring-4 ring-orange-50' : 'border-gray-100 hover:border-orange-200 hover:shadow-md'
                  }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-50 text-orange-700 flex items-center justify-center font-black text-lg border border-orange-100">
                        {v.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-gray-800 text-base">{v.full_name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">المعرف: {v.visit_number}</span>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">العمر: {v.age}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left flex flex-col items-end gap-1.5">
                      <p className="text-[11px] font-black bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <FlaskConical size={12} className="text-orange-400" />
                        {v.total_pending_tests} {activeTab === 'completed' ? 'تحاليل منجزة' : activeTab === 'in_progress' ? 'تحاليل قيد الإجراء' : 'تحاليل مسجلة'}
                      </p>
                      {activeTab !== 'in_progress' && activeTab !== 'completed' && v.total_in_progress > 0 && (
                        <p className="text-[10px] bg-blue-50 border border-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <RefreshCcw size={10} className="animate-spin-slow" />
                          {v.total_in_progress} قيد العمل
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selected && (
          <PatientDetailModal visitId={selected.visit_id} token={token}
            onClose={() => setSelected(null)} onCompleted={() => { fetchRequests(); setSelected(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LabRequests;
