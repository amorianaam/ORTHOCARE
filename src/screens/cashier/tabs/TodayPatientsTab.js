import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, Grid, List } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';

// ── Main Screen ────────────────────────────────────────────────────
const TodayPatientsTab = ({ viewMode = 'grid', setViewMode, onPatientClick }) => {
  const { token } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/patients/visits/today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch (e) { toast.error('فشل تحميل بيانات مراجعو اليوم'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    window.addEventListener('cashier_update', fetchData);
    return () => window.removeEventListener('cashier_update', fetchData);
  }, [fetchData]);

  const STATUS_LABELS = {
    pending_payment: 'غير مدفوع (رسوم كشف)',
    paid: 'مدفوع',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
    awaiting_service_payment: 'غير مدفوع (خدمات)',
    completed_admin_pending_services: 'دفع جزئي (خدمات)',
    waiting: 'بانتظار الطبيب',
    cancelled: 'ملغى'
  };

  const STATUS_COLORS = {
    pending_payment: 'bg-red-50 text-red-600 border-red-100',
    awaiting_service_payment: 'bg-red-50 text-red-600 border-red-100',
    paid: 'bg-sky-50 text-emerald-600 border-sky-100',
    in_progress: 'bg-blue-50 text-blue-600 border-blue-100',
    completed: 'bg-slate-50 text-sky-600 border-sky-100',
    completed_admin_pending_services: 'bg-amber-50 text-amber-600 border-amber-100',
    waiting: 'bg-sky-50 text-emerald-600 border-sky-100',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">قائمة المرضى لليوم</h2>
          <p className="text-sm text-gray-500 mt-0.5">إجمالي {visits.length} زيارة اليوم</p>
        </div>
        <div className="flex items-center gap-2">
          {setViewMode && (
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm mr-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-50 text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                title="عرض شبكي"
              >
                <Grid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-50 text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                title="عرض قائمة"
              >
                <List size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <span className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full" />
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Users size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-bold">لا يوجد مرضى مسجلين لهذا اليوم</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
            {visits.map((v, i) => {
              const colorClass = STATUS_COLORS[v.status] || STATUS_COLORS.waiting;
              return (
                <motion.div key={v.id}
                  onClick={() => onPatientClick && onPatientClick(v.patient_id)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`cursor-pointer bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-5 h-40 relative overflow-hidden group ${colorClass.replace('bg-', 'border-').replace('50', '100')}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner border flex-shrink-0 ${colorClass}`}>
                      {v.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 leading-tight text-sm line-clamp-1">{v.full_name}</p>
                      <p className="text-[10px] text-gray-500 font-bold mt-1 bg-gray-50 px-2 py-0.5 rounded-lg inline-block border border-gray-100">رقم الزيارة: {v.visit_number}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex justify-end">
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border shadow-sm ${colorClass}`}>
                      {STATUS_LABELS[v.status] || 'غير محدد'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                <tr>
                  <th className="p-4">المراجع</th>
                  <th className="p-4">تاريخ الزيارة</th>
                  <th className="p-4">حالة الزيارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visits.map((v) => {
                  const colorClass = STATUS_COLORS[v.status] || STATUS_COLORS.waiting;
                  return (
                    <tr key={v.id} onClick={() => onPatientClick && onPatientClick(v.patient_id)} className="cursor-pointer hover:bg-slate-50/50 transition-colors">
                      
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${colorClass}`}>
                            {v.full_name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-800">{v.full_name}</span>
                            <span className="text-[10px] font-mono font-bold text-gray-400">#{v.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-gray-500 text-[11px] font-bold">
                        {new Date(v.created_at).toLocaleString('en-GB')}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${colorClass}`}>
                          {STATUS_LABELS[v.status] || 'غير محدد'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayPatientsTab;
