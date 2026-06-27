import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Users, Tag, Award, Calendar, RefreshCcw,
  Layers, FlaskConical, Radiation, ShieldAlert, Eye, X, BookOpen, Clock,
  ArrowUpRight, Printer, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import taffyot from '../../utils/taffyot';

export default function DoctorReports() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  // Data States
  const [completedCases, setCompletedCases] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [exemptions, setExemptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'discounts' | 'exemptions'
  const [selectedCase, setSelectedCase] = useState(null);

  // ─── Fetch Analytical Reports ────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/doctor/reports/analytical';
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `?startDate=${customRange.start}&endDate=${customRange.end}`;
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
        url += `?startDate=${start}&endDate=${format(now)}`;
      }

      const res = await axios.get(url, { headers });
      setCompletedCases(res.data.completedCases || []);
      setDiscounts(res.data.discounts || []);
      setExemptions(res.data.exemptions || []);
    } catch {
      toast.error('فشل في جلب التقارير التحليلية');
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Reset Filters
  const handleResetFilters = () => {
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    toast.info('تم إعادة تعيين فلاتر التقارير');
  };

  // ─── Calculations & Taffyot Spellers ──────────────────────────────
  const totalDiscounts = useMemo(() => {
    return discounts.reduce((sum, item) => sum + (parseFloat(item.discount_amount) || 0), 0);
  }, [discounts]);

  const spelledDiscounts = useMemo(() => {
    return taffyot(totalDiscounts);
  }, [totalDiscounts]);

  const totalExemptions = useMemo(() => {
    return exemptions.reduce((sum, item) => sum + (parseFloat(item.original_price) || 0), 0);
  }, [exemptions]);

  const spelledExemptions = useMemo(() => {
    return taffyot(totalExemptions);
  }, [totalExemptions]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-3xl text-white border border-indigo-950 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-700/80 flex items-center justify-center text-indigo-200">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">التقارير الطبية والتحليلات البيانية</h1>
              <p className="text-slate-400 text-xs mt-1">تتبع أداء الحالات المنجزة اليوم والخصومات الممنوحة وقيم الإعفاءات الإنسانية</p>
            </div>
          </div>
          <button onClick={fetchReports} className="btn-secondary bg-slate-800 hover:bg-slate-700 border-none text-slate-200 flex items-center gap-2 text-xs py-2">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
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
                  dateFilter === f.id ? 'bg-white text-indigo-800 shadow-xs' : 'hover:bg-white/40'
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
        {dateFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center text-xs"
          >
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
          </motion.div>
        )}
      </div>

      {/* KPI Overviews */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Completed Cases KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">الحالات المنجزة</span>
            <h3 className="text-xl font-black text-gray-800">{completedCases.length} مريض</h3>
            <p className="text-[10px] text-gray-400 font-semibold">مغادرة العيادة بالكامل</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Users size={20}/></div>
        </div>

        {/* Discounts KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">إجمالي الخصومات</span>
            <h3 className="text-xl font-black text-indigo-700">{totalDiscounts.toLocaleString()} ريال</h3>
            {totalDiscounts > 0 && (
              <p className="text-[9px] text-indigo-500 font-bold leading-normal" title={spelledDiscounts}>
                ({spelledDiscounts})
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Tag size={20}/></div>
        </div>

        {/* Exemptions KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">قيمة الإعفاءات (VIP)</span>
            <h3 className="text-xl font-black text-emerald-700">{totalExemptions.toLocaleString()} ريال</h3>
            {totalExemptions > 0 && (
              <p className="text-[9px] text-emerald-500 font-bold leading-normal" title={spelledExemptions}>
                ({spelledExemptions})
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Award size={20}/></div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-gray-100 bg-white p-2 gap-1 text-xs font-bold text-gray-500 rounded-3xl shadow-xs border">
        {[
          { id: 'cases', label: 'تقرير الحالات المنجزة 📋', icon: BookOpen },
          { id: 'discounts', label: 'تقرير الخصومات الممنوحة 🏷️', icon: Tag },
          { id: 'exemptions', label: 'تقرير الإعفاءات والتحويلات المجانية 👑', icon: ShieldAlert }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                : 'hover:bg-gray-50 text-gray-500'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Detailed Reports Render */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
          
          {/* TAB 1: CASES */}
          {activeTab === 'cases' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                <tr>
                  <th className="p-3.5">الزيارة</th>
                  <th className="p-3.5">المريض</th>
                  <th className="p-3.5">العمر والجنس</th>
                  <th className="p-3.5">تاريخ المعاينة</th>
                  <th className="p-3.5">الإجراءات والخدمات</th>
                  <th className="p-3.5 w-24">الملف</th>
                </tr>
              </thead>
              <tbody>
                {completedCases.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-gray-400 font-bold">لا يوجد حالات منجزة في هذه الفترة.</td>
                  </tr>
                ) : (
                  completedCases.map((item, idx) => {
                    const servicesCount = (item.labRequests?.length || 0) + (item.radiologyRequests?.length || 0) + (item.clinicalRequests?.length || 0);
                    return (
                      <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="p-3.5 font-extrabold text-slate-800">{item.visit_number}</td>
                        <td className="p-3.5 font-extrabold text-slate-700">{item.full_name}</td>
                        <td className="p-3.5 text-gray-500 font-bold">{item.age} سنة · {item.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}</td>
                        <td className="p-3.5 text-gray-400 font-bold">{new Date(item.closed_at).toLocaleString('ar')}</td>
                        <td className="p-3.5">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black">
                            {servicesCount} خدمة طبية
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => setSelectedCase(item)}
                            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: DISCOUNTS */}
          {activeTab === 'discounts' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                <tr>
                  <th className="p-3.5">تاريخ الطلب</th>
                  <th className="p-3.5">المريض</th>
                  <th className="p-3.5">نوع الفحص / الخدمة</th>
                  <th className="p-3.5">السعر الأساسي</th>
                  <th className="p-3.5">نسبة الخصم</th>
                  <th className="p-3.5">قيمة الخصم</th>
                  <th className="p-3.5">السعر النهائي المعتمد</th>
                </tr>
              </thead>
              <tbody>
                {discounts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-10 text-center text-gray-400 font-bold">لا يوجد خصومات ممنوحة في هذه الفترة.</td>
                  </tr>
                ) : (
                  discounts.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="p-3.5 text-gray-400 font-bold">{new Date(item.date).toLocaleDateString('ar')}</td>
                      <td className="p-3.5 font-extrabold text-slate-800">{item.patient_name}</td>
                      <td className="p-3.5">
                        <span className="font-extrabold text-slate-700 block">{item.service_name}</span>
                        <span className="text-[9px] font-black text-gray-400 uppercase">{item.type === 'lab' ? 'تحليل مخبري' : item.type === 'radiology' ? 'أشعة' : 'خدمة سريرية'}</span>
                      </td>
                      <td className="p-3.5 font-black text-gray-500">
                        {item.original_price} ريال
                        {parseFloat(item.original_price) > 0 && (
                          <span className="block text-[8px] text-gray-400 font-bold mt-0.5">({taffyot(item.original_price)})</span>
                        )}
                      </td>
                      <td className="p-3.5 text-indigo-700 font-extrabold">% {item.discount_percentage}</td>
                      <td className="p-3.5 text-red-600 font-black">
                        {item.discount_amount} ريال
                        {parseFloat(item.discount_amount) > 0 && (
                          <span className="block text-[8px] text-gray-400 font-bold mt-0.5">({taffyot(item.discount_amount)})</span>
                        )}
                      </td>
                      <td className="p-3.5 text-emerald-700 font-black">
                        {item.final_price} ريال
                        {parseFloat(item.final_price) > 0 && (
                          <span className="block text-[8px] text-gray-400 font-bold mt-0.5">({taffyot(item.final_price)})</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: EXEMPTIONS */}
          {activeTab === 'exemptions' && (
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                <tr>
                  <th className="p-3.5">تاريخ الطلب</th>
                  <th className="p-3.5">المريض المستفيد</th>
                  <th className="p-3.5">الخدمة المعفاة</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">قيمتها الأصلية المهدورة</th>
                </tr>
              </thead>
              <tbody>
                {exemptions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-gray-400 font-bold">لا يوجد تحويلات مجانية أو إعفاءات في هذه الفترة.</td>
                  </tr>
                ) : (
                  exemptions.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="p-3.5 text-gray-400 font-bold">{new Date(item.date).toLocaleDateString('ar')}</td>
                      <td className="p-3.5 font-extrabold text-slate-800">{item.patient_name}</td>
                      <td className="p-3.5 font-extrabold text-slate-700">{item.service_name}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                          item.type === 'lab' ? 'bg-blue-100 text-blue-700' :
                          item.type === 'radiology' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.type === 'lab' ? 'مختبر' : item.type === 'radiology' ? 'أشعة' : 'خدمة'}
                        </span>
                      </td>
                      <td className="p-3.5 text-red-600 font-black">
                        {item.original_price} ريال
                        {parseFloat(item.original_price) > 0 && (
                          <span className="block text-[8px] text-gray-400 font-bold mt-0.5">({taffyot(item.original_price)})</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

        </div>
      )}

      {/* ─── READ-ONLY DRILL DOWN EMR MODAL ─── */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl h-[80vh] overflow-hidden flex flex-col border border-gray-100"
            >
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-150 flex-shrink-0 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base font-black shadow">
                    {selectedCase.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-800">{selectedCase.full_name}</h3>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">زيارة رقم: {selectedCase.visit_number} · مؤرشفة</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCase(null)} className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>

              {/* Scroll Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {/* General Info */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-150 font-bold text-gray-600">
                  <p>نوع الزيارة: {selectedCase.is_exempt ? 'حالة إعفاء VIP 👑' : selectedCase.is_follow_up ? 'مراجعة مجانية' : 'كشف جديد'}</p>
                  <p>تاريخ الإغلاق: {new Date(selectedCase.closed_at).toLocaleString('ar')}</p>
                  <p>الهاتف: {selectedCase.phone || '—'}</p>
                  <p>العمر والجنس: {selectedCase.age} سنة · {selectedCase.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
                </div>

                {/* Services Ordered */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-sm text-gray-800">🧪 الخدمات المطلوبة والمسددة:</h4>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full text-right text-[11px] font-bold">
                      <thead className="bg-gray-50 border-b border-gray-150 text-gray-500">
                        <tr>
                          <th className="p-3">الخدمة</th>
                          <th className="p-3">القسم</th>
                          <th className="p-3">السعر الأساسي</th>
                          <th className="p-3">الخصم الممنوح</th>
                          <th className="p-3">السعر النهائي المعتمد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...(selectedCase.labRequests || []).map(r => ({ ...r, typeLabel: 'مختبر', labelColor: 'bg-blue-50 text-blue-700' })),
                          ...(selectedCase.radiologyRequests || []).map(r => ({ ...r, typeLabel: 'أشعة', labelColor: 'bg-rose-50 text-rose-700' })),
                          ...(selectedCase.clinicalRequests || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية', labelColor: 'bg-emerald-50 text-emerald-700' }))
                        ].length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-gray-400 font-bold">لم يتم طلب أي خدمات في هذه الزيارة.</td>
                          </tr>
                        ) : (
                          [
                            ...(selectedCase.labRequests || []).map(r => ({ ...r, typeLabel: 'مختبر', labelColor: 'bg-blue-50 text-blue-700' })),
                            ...(selectedCase.radiologyRequests || []).map(r => ({ ...r, typeLabel: 'أشعة', labelColor: 'bg-rose-50 text-rose-700' })),
                            ...(selectedCase.clinicalRequests || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية', labelColor: 'bg-emerald-50 text-emerald-700' }))
                          ].map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-50">
                              <td className="p-3 font-extrabold text-gray-800">{item.name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black ${item.labelColor}`}>
                                  {item.typeLabel}
                                </span>
                              </td>
                              <td className="p-3 text-gray-500">{item.price} ريال</td>
                              <td className="p-3 text-red-500">{item.is_free ? 'إعفاء كلي' : `% ${item.discount_percentage} (${item.discount_amount} ريال)`}</td>
                              <td className="p-3 text-emerald-700">{item.is_free ? '0 ريال (مجاني)' : `${item.final_price || 0} ريال`}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t bg-gray-50/50 flex justify-end">
                <button
                  onClick={() => setSelectedCase(null)}
                  className="px-5 py-2.5 bg-slate-800 text-white font-black rounded-xl text-xs"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
