import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PatientExaminationCard from '../../components/common/PatientExaminationCard';
import PatientEMRModal from '../../components/common/PatientEMRModal';
import {
  Search, Calendar, Filter, RefreshCcw, LayoutGrid, List,
  History, User, Phone, ChevronRight, X, Printer,
  Eye, Pill, FlaskConical, Radiation, Layers, AlertCircle, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import axios from 'axios';
import useAuthStore from '../../store/useAuthStore';

const PAGE_SIZE = 12;

export default function PatientsArchive() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

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

  // ─── Advanced Search & Temporal Filtering ──────────────────────────
  const filteredPatients = useMemo(() => {
    let result = patients;

    // 1. Search filter
    if (query.trim()) {
      const fuse = new Fuse(patients, {
        keys: ['full_name', 'phone'],
        threshold: 0.35
      });
      result = fuse.search(query).map(r => r.item);
    }

    // 2. Temporal/Date filters
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

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPatients, page]);

  // Reset all filters
  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين فلاتر البحث لليوم الحالي');
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
      
      // Auto-select the latest visit if any exists
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
    const originalContent = document.body.innerHTML;
    
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
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white border border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/80 flex items-center justify-center shadow-lg text-emerald-400">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">أرشيف المرضى والزيارات السابقة</h1>
              <p className="text-slate-400 text-xs mt-1">البحث في السجلات الطبية التاريخية والاطلاع عليها بوضع القراءة فقط الصارم</p>
            </div>
          </div>
          <button onClick={fetchPatients} disabled={loading} className="btn-secondary bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 flex items-center gap-2 text-xs py-2">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم الرباعي أو رقم الهاتف..."
              className="input-base pr-10 text-xs py-2.5 font-semibold"
            />
          </div>

          {/* Temporal filter tabs */}
          <div className="md:col-span-6 flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500">
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
                  dateFilter === f.id ? 'bg-white text-slate-800 shadow-xs' : 'hover:bg-white/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === 'custom' && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">من:</span>
              <input
                type="date"
                value={customRange.start}
                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">إلى:</span>
              <input
                type="date"
                value={customRange.end}
                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold mr-auto"
            >
              إعادة تعيين
            </button>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500">
          <span>تم العثور على {filteredPatients.length} مريض</span>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-slate-800' : 'text-gray-400'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-slate-800' : 'text-gray-400'}`}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List of Patients */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-150 h-80 flex flex-col justify-center items-center">
          <Search size={40} className="text-gray-300 mb-3 animate-pulse" />
          <p className="font-extrabold text-gray-700 text-sm">لا توجد سجلات مطابقة</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من كتابة الاسم بشكل صحيح أو تصفية التواريخ بدقة.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedPatients.map(p => (
                <PatientExaminationCard
                  key={p.id}
                  patient={p}
                  onClick={() => handleOpenEMR(p)}
                  actionText="عرض الملف"
                  showDate={true}
                  dateValue={new Date(p.created_at).toLocaleDateString('ar')}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedPatients.map(p => (
                <PatientExaminationCard
                  key={p.id}
                  patient={p}
                  onClick={() => handleOpenEMR(p)}
                  actionText="عرض الملف"
                  showDate={true}
                  dateValue={new Date(p.created_at).toLocaleDateString('ar')}
                />
              ))}
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-gray-50/50 p-4 rounded-2xl border">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 bg-white border rounded-xl disabled:opacity-40 font-black">السابق</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 bg-white border rounded-xl disabled:opacity-40 font-black">التالي</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORIC READ-ONLY EMR MODAL ─── */}
      <PatientEMRModal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        patient={selectedPatient}
        readOnly={true}
        historyLoading={historyLoading}
        patientHistory={patientHistory}
        selectedVisit={selectedVisit}
        onSelectVisit={handleSelectVisit}
        prescriptionItems={prescriptionItems}
        loadingPrescription={loadingPrescription}
        onPrintPrescription={handlePrintPrescription}
      />
    </div>
  );
}
