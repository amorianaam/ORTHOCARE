import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Calendar, Filter, RefreshCcw, LayoutGrid, List,
  History, User, Phone, ChevronRight, X, Printer,
  Eye, Pill, FlaskConical, Radiation, Layers, AlertCircle, Clock,
  Save, Pencil, SendHorizontal, ChevronDown, ChevronLeft
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import HistoricEMRModal from '../components/HistoricEMRModal';

const PAGE_SIZE = 12;

// ── Edit Modal ──────────────────────────────────────────────────────
const EditModal = ({ patient, token, onClose, onSaved }) => {
  const [form, setForm] = useState({
    fullName: patient.full_name || '',
    age: patient.age || '',
    gender: patient.gender || 'male',
    phone: patient.phone || '',
    chronicDiseases: patient.chronic_diseases || '',
    allergies: patient.allergies || '',
    currentMedications: patient.current_medications || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error('الاسم مطلوب');
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { toast.success('تم تحديث بيانات المريض'); onSaved(); onClose(); }
      else toast.error(data.message);
    } catch { toast.error('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-l from-teal-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={17} className="text-teal-600" />
            <h3 className="font-bold text-gray-800">تعديل بيانات المريض</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل *</label>
            <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              required className="input-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">العمر *</label>
              <input type="number" min="0" max="150" value={form.age}
                onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الجنس</label>
              <div className="relative">
                <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                  className="input-base appearance-none">
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم الهاتف</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              type="tel" className="input-base" placeholder="09XXXXXXXX" />
          </div>

        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={handleSubmit} disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
            {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={14} />}
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button onClick={onClose} className="btn-secondary text-sm">إلغاء</button>
        </div>
      </motion.div>
    </div>
  );
};

export default function PatientsList() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const location = useLocation();
  const navigate = useNavigate();

  // Core Data
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'list'
  const [page, setPage] = useState(1);

  // Selected EMR Patient View
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);

  // EMR Active Tab (inside read-only EMR view)
  const [emrTab, setEmrTab] = useState('timeline'); // 'timeline' | 'orders' | 'results' | 'prescription'

  // Actions
  const [editPatient, setEditPatient] = useState(null);
  const [sendingReview, setSendingReview] = useState(null);

  // ─── Fetch All Patients ──────────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/patients', { headers });
      setPatients(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('فشل تحميل أرشيف المرضى');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (location.state?.openPatientId && patients.length > 0 && !selectedPatient) {
      const p = patients.find(x => x.id === location.state.openPatientId);
      if (p) {
        handleOpenEMR(p);
      }
      // Clear state so it doesn't reopen if the user refreshes
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, patients, selectedPatient, navigate, location.pathname]);

  // ─── Advanced Search & Temporal Filtering ──────────────────────────
  const filteredPatients = useMemo(() => {
    let result = patients;

    if (query.trim()) {
      const fuse = new Fuse(patients, {
        keys: ['full_name', 'phone'],
        threshold: 0.35
      });
      result = fuse.search(query).map(r => r.item);
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= startOfDay;
      });
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= oneWeekAgo;
      });
    } else if (dateFilter === 'month') {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= oneMonthAgo;
      });
    } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= start && pDate <= end;
      });
    }

    return result;
  }, [patients, query, dateFilter, customRange]);

  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPatients, page]);

  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين فلاتر البحث');
  };

  const handleSendReview = async (e, patient) => {
    e.stopPropagation();
    setSendingReview(patient.id);
    try {
      const res = await fetch('/api/patients/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: patient.id }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`تم إرسال ${patient.full_name} إلى قائمة الانتظار`);
      else toast.error(data.message || 'حدث خطأ');
    } catch { toast.error('تعذر الاتصال'); }
    finally { setSendingReview(null); }
  };

  const handleEditPatient = (e, patient) => {
    e.stopPropagation();
    setEditPatient(patient);
  };

  // ─── Historic EMR Loading ─────────────────────────────────────────
  const handleOpenEMR = async (patient) => {
    setSelectedPatient(patient);
    setPatientHistory([]);
    setSelectedVisit(null);
    setPrescriptionItems([]);
    setEmrTab('timeline');

    try {
      setHistoryLoading(true);
      const res = await axios.get(`/api/doctor/patient/${patient.id}/history`, { headers });
      const visits = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(visits);
      
      if (visits.length > 0) {
        handleSelectVisit(visits[0]);
      }
    } catch {
      toast.error('فشل تحميل السجل التاريخي للمريض');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectVisit = async (visit) => {
    setSelectedVisit(visit);
    setPrescriptionItems([]);
    setLoadingPrescription(true);

    try {
      const prescRes = await axios.get(`/api/doctor/visit/${visit.id}/prescription`, { headers });
      if (prescRes.data && prescRes.data.items) {
        setPrescriptionItems(prescRes.data.items);
      }
    } catch {
      setPrescriptionItems([]);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handlePrintPrescription = () => {
    if (!selectedVisit) return;
    const printContent = document.getElementById('print-area').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الوصفة الطبية</title>
          <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .patient-info { display: grid; grid-cols: 2; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .rx-title { font-size: 20px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            .item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-6 rounded-3xl shadow-xl text-white border border-teal-600">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg text-teal-100">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">أرشيف المرضى</h1>
              <p className="text-teal-100/70 text-xs mt-1">البحث السريع والتعديل وإدارة السجلات الطبية السابقة</p>
            </div>
          </div>
          <button onClick={fetchPatients} disabled={loading} className="btn-secondary bg-white/10 hover:bg-white/20 text-white border-white/20 flex items-center gap-2 text-xs py-2 border-0">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> تحديث السجلات
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم الرباعي أو رقم الهاتف..."
              className="input-base pr-10 text-xs py-2.5 font-semibold"
            />
          </div>

          <div className="md:col-span-6 flex gap-1.5 bg-gray-50 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 border border-gray-100">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'هذا الأسبوع' },
              { id: 'month', label: 'هذا الشهر' },
              { id: 'custom', label: 'تاريخ مخصص' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setDateFilter(f.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  dateFilter === f.id ? 'bg-white text-teal-800 shadow-xs ring-1 ring-gray-100' : 'hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex flex-wrap gap-4 items-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700">من:</span>
              <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className="px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-bold outline-none text-gray-700" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700">إلى:</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className="px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-bold outline-none text-gray-700" />
            </div>
            <button onClick={handleResetFilters} className="px-4 py-1.5 text-xs bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-bold mr-auto border border-gray-200 transition-colors">
              إعادة تعيين
            </button>
          </motion.div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500">
          <span>تم العثور على {filteredPatients.length} مريض مسجل</span>
          <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-teal-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-teal-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Patients View (Grid/List) */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 h-80 flex flex-col justify-center items-center">
          <Search size={40} className="text-gray-300 mb-3 animate-pulse" />
          <p className="font-extrabold text-gray-700 text-sm">لا توجد سجلات مطابقة</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من كتابة الاسم بشكل صحيح أو تصفية التواريخ بدقة.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedPatients.map(p => (
                <div key={p.id} onClick={() => handleOpenEMR(p)}
                  className="bg-white border border-gray-100 hover:border-teal-200 rounded-3xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group relative overflow-hidden h-44"
                >
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 flex items-center justify-center font-black text-sm border border-teal-200/50 flex-shrink-0">
                          {p.full_name?.charAt(0)}
                        </div>
                        <div>
                          <span className="font-extrabold text-sm text-gray-800 line-clamp-1">{p.full_name}</span>
                          <span className="text-[10px] font-bold text-gray-400 block">{p.age ? `${p.age} سنة` : '—'} · {p.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 font-bold space-y-1.5 pt-2">
                      <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> {p.phone || 'لا يوجد هاتف'}</p>
                      <p className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-400" /> {new Date(p.created_at).toLocaleDateString('ar')}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-gray-50 pt-3 relative z-10">
                    <div className="flex gap-1.5">
                      <button onClick={(e) => handleEditPatient(e, p)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors" title="تعديل">
                        <Pencil size={14} />
                      </button>
                      <button onClick={(e) => handleSendReview(e, p)} disabled={sendingReview === p.id} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50" title="إرسال للطبيب">
                        {sendingReview === p.id ? <span className="animate-spin w-3.5 h-3.5 border border-emerald-600/30 border-t-emerald-600 rounded-full inline-block" /> : <SendHorizontal size={14} />}
                      </button>
                    </div>
                    <span className="text-[10px] font-black text-teal-600 flex items-center gap-0.5 group-hover:translate-x-[-4px] transition-transform">
                      عرض الملف <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 font-bold text-gray-500">
                  <tr>
                    <th className="p-4">المريض</th>
                    <th className="p-4">العمر والجنس</th>
                    <th className="p-4">رقم الهاتف</th>
                    <th className="p-4">تاريخ التسجيل</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((p, idx) => (
                    <tr key={p.id} onClick={() => handleOpenEMR(p)} className={`border-b border-gray-50 hover:bg-teal-50/30 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 flex items-center justify-center font-black flex-shrink-0">
                            {p.full_name?.charAt(0)}
                          </div>
                          <span className="font-extrabold text-gray-800 text-sm">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-gray-500">{p.age ? `${p.age} سنة` : '—'} · {p.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                      <td className="p-4 font-mono text-gray-500 font-bold">{p.phone || '—'}</td>
                      <td className="p-4 text-gray-400 font-bold">{new Date(p.created_at).toLocaleDateString('ar')}</td>
                      <td className="p-4">
                        <div className="flex justify-center items-center gap-2">
                          <button onClick={(e) => handleEditPatient(e, p)} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors" title="تعديل">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(e) => handleSendReview(e, p)} disabled={sendingReview === p.id} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50" title="إرسال للطبيب">
                            {sendingReview === p.id ? <span className="animate-spin w-3.5 h-3.5 border border-emerald-600/30 border-t-emerald-600 rounded-full inline-block" /> : <SendHorizontal size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronRight size={16}/></button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronLeft size={16}/></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal (Secretary specific) */}
      <AnimatePresence>
        {editPatient && (
          <EditModal patient={editPatient} token={token} onClose={() => setEditPatient(null)} onSaved={fetchPatients} />
        )}
      </AnimatePresence>

      {/* ─── HISTORIC READ-ONLY EMR MODAL ─── */}
      <AnimatePresence>
        {selectedPatient && !editPatient && (
          <HistoricEMRModal
            patient={selectedPatient}
            onClose={() => setSelectedPatient(null)}
            token={token}
            hideFinancials={true}
            onEditPatient={() => setEditPatient(selectedPatient)}
            onSendReview={(e) => handleSendReview(e, selectedPatient)}
            sendingReview={sendingReview}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
