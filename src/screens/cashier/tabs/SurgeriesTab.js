import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors, Plus, X, Check,
  ChevronDown, TrendingUp, Clock, AlertCircle, Printer, Grid, List
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';
import InvoiceTemplate from '../../../components/InvoiceTemplate';

// ── Progress Bar ───────────────────────────────────────────────────
const ProgressBar = ({ paid, total }) => {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const color = pct >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : pct >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-gradient-to-r from-amber-400 to-amber-500';
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
        <span>المدفوع {pct.toFixed(0)}%</span>
        <span>المتبقي {(100 - pct).toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

// ── Add Payment Modal ──────────────────────────────────────────────
const PayModal = ({ surgery, token, onClose, onPaid }) => {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPay, setLoadingPay] = useState(true);

  const remaining = parseFloat(surgery.full_price || 0)
    - parseFloat(surgery.discount_amount || 0)
    - parseFloat(surgery.paid_amount || 0);

  useEffect(() => {
    fetch(`/api/cashier/surgery/${surgery.surgery_id}/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setPayments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingPay(false));
  }, [surgery.surgery_id, token]);

  const handlePay = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return toast.error('أدخل مبلغاً صحيحاً');
    
    let equivalentAmount = parseFloat(amount);

    if (equivalentAmount > remaining + 1)
      return toast.error(`المبلغ يعادل (${equivalentAmount.toFixed(2)}) وهو يتجاوز المتبقي (${remaining.toFixed(2)} YER)`);

    setSaving(true);
    try {
      const res = await fetch(`/api/cashier/surgery/${surgery.surgery_id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          amount: parseFloat(amount)
        }),
      });
      const data = await res.json();
      if (res.ok) { 
        toast.success(data.message); 
        onPaid({
          patientName: surgery.full_name,
          visitNumber: surgery.visit_number,
          items: [{ description: `دفعة عملية جراحية (${surgery.surgery_type})`, total: parseFloat(amount) }],
          subtotal: parseFloat(amount),
          totalPaid: parseFloat(amount),
          currency: 'YER'
        }); 
        onClose(); 
      }
      else toast.error(data.message);
    } catch (e) { toast.error('تعذر الاتصال'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50"
          style={{background:'linear-gradient(135deg, #FAF5FF, #F3E8FF)'}}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-200/50 flex items-center justify-center">
              <Plus size={20} className="text-sky-700" />
            </div>
            <h3 className="font-black text-sky-900 text-lg">إضافة دفعة عملية</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="p-6">
          {/* Surgery Summary */}
          <div className="bg-slate-900 rounded-2xl p-5 mb-5 shadow-inner">
            <p className="font-bold text-white mb-1">{surgery.full_name}</p>
            <p className="text-xs text-sky-300 mb-4">{surgery.surgery_type}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'الإجمالي', value: (surgery.full_price - (surgery.discount_amount || 0)).toFixed(2) },
                { label: 'المدفوع', value: parseFloat(surgery.paid_amount || 0).toFixed(2), color: 'text-emerald-400' },
                { label: 'المتبقي', value: remaining.toFixed(2), color: remaining > 0 ? 'text-red-400' : 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                  <p className="text-[11px] text-gray-300 mb-1">{item.label}</p>
                  <p className={`font-black tracking-tight ${item.color || 'text-white'}`}>{item.value} <span className="text-[9px] text-gray-400 tracking-normal uppercase">YER</span></p>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <ProgressBar paid={parseFloat(surgery.paid_amount || 0)} total={surgery.full_price - (surgery.discount_amount || 0)} />
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">مبلغ الدفعة (ريال يمني)</label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-base text-lg font-bold text-center"
                  placeholder="المبلغ"
                />
                <button
                  type="button"
                  onClick={() => setAmount(remaining.toFixed(2))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold hover:text-blue-800"
                >
                  تغطية المتبقي
                </button>
              </div>
            </div>
          </div>

          {/* Previous Payments */}
          {!loadingPay && payments.length > 0 && (
            <div className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
              <p className="text-xs font-bold text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-100">
                الدفعات السابقة ({payments.length})
              </p>
              <div className="divide-y divide-gray-50 max-h-36 overflow-y-auto">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-500">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString('ar')}
                    </span>
                    <span className="text-sm font-bold text-sky-700">{p.amount} YER</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-50 mt-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
            <button onClick={handlePay} disabled={saving || !amount}
              className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-l from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-[11px] font-bold transition-all shadow-sm">
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Check size={14} />}
              {saving ? 'جاري الحفظ...' : 'تأكيد الدفعة'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const SurgeriesTab = ({ viewMode = 'grid', setViewMode, onPatientClick }) => {
  const { token } = useAuthStore();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [payModal, setPayModal]   = useState(null);
  const [filter, setFilter]       = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cashier/surgeries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSurgeries(Array.isArray(data) ? data : []);
    } catch (e) { toast.error('فشل تحميل بيانات العمليات'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    window.addEventListener('cashier_update', fetchData);
    return () => window.removeEventListener('cashier_update', fetchData);
  }, [fetchData]);

  const handlePaymentSuccess = (invData) => {
    setInvoiceData({ ...invData, cashierName: 'القسم المالي' });
    fetchData();
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const FILTERS = [
    { key: 'all',        label: 'الكل' },
    { key: 'partial',    label: 'دفع جزئي' },
  ];

  const filtered = filter === 'all' ? surgeries
    : surgeries.filter(s => parseFloat(s.remaining_amount) > 0 && parseFloat(s.paid_amount) > 0);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900">العمليات الجراحية</h2>
          <p className="text-sm text-gray-500 mt-0.5">{surgeries.length} عملية</p>
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

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === f.key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <span className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Scissors size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-bold">لا توجد عمليات في هذه الحالة</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {filtered.map((s, i) => {
              const net  = parseFloat(s.full_price) - parseFloat(s.discount_amount || 0);
              const paid = parseFloat(s.paid_amount || 0);
              const rem  = parseFloat(s.remaining_amount || 0);

              return (
                <motion.div key={s.surgery_id}
                  onClick={() => onPatientClick && onPatientClick(s.patient_id)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="cursor-pointer bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-5 h-56 relative overflow-hidden group"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 to-sky-600 absolute top-0 left-0 right-0" />
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-black text-lg shadow-inner border border-sky-100/50">
                        {s.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-extrabold text-gray-900 leading-tight text-sm line-clamp-1">{s.full_name}</p>
                        <p className="text-[10px] text-sky-600 font-bold mt-1 bg-sky-50 px-2 py-0.5 rounded-lg inline-block border border-sky-100">{s.surgery_type || 'غير محدد'}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {rem > 0 ? (
                        <div className="text-left bg-red-50 px-2 py-1 rounded-lg border border-red-100 text-red-600 font-black text-xs shadow-inner">
                          <p className="text-[8px] text-red-400 mb-0.5 uppercase tracking-wider">المتبقي</p>
                          {rem.toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-sky-50 text-emerald-600 border border-sky-100 shadow-sm">
                          ✓ مكتمل الدفع
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'السعر', value: net.toFixed(2), color: 'text-gray-900' },
                      { label: 'المدفوع', value: paid.toFixed(2), color: 'text-emerald-600' },
                      { label: 'المتبقي', value: rem.toFixed(2), color: rem > 0 ? 'text-red-500' : 'text-emerald-600' },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100 shadow-inner">
                        <p className="text-[9px] font-bold text-gray-400 mb-0.5">{item.label}</p>
                        <p className={`font-black text-[11px] ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <ProgressBar paid={paid} total={net} />

                  <div className="mt-auto pt-4 flex gap-2 relative z-10">
                    {rem > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); setPayModal(s); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-600 text-white text-[11px] font-bold hover:bg-sky-700 transition-colors shadow-sm">
                        <Plus size={14} /> إضافة دفعة
                      </button>
                    ) : (
                      <span className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-50 text-emerald-600 border border-sky-100 shadow-sm text-[11px] font-bold">
                        ✓ مكتمل
                      </span>
                    )}
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
                  <th className="p-4">تاريخ الإضافة</th>
                  <th className="p-4">نوع العملية</th>
                  <th className="p-4">المبلغ المتبقي</th>
                  <th className="p-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => {
                  const rem = parseFloat(s.remaining_amount || 0);
                  return (
                    <tr key={s.surgery_id} onClick={() => onPatientClick && onPatientClick(s.patient_id)} className="cursor-pointer hover:bg-slate-50/50 transition-colors">
                      
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-black text-xs border border-sky-100">
                            {s.full_name?.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-extrabold text-gray-800">{s.full_name}</span>
                            <span className="text-[10px] font-mono font-bold text-gray-400">#{s.id || s.visit_id || s.surgery_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-gray-600">{s.surgery_type || '--'}</td>
                      <td className="p-4">
                        {rem > 0 ? (
                           <span className="font-black text-red-500">{rem.toFixed(2)} YER</span>
                        ) : (
                           <span className="font-bold text-emerald-600 text-[10px] bg-sky-50 px-2 py-1 rounded-md">✓ مكتمل</span>
                        )}
                      </td>
                      <td className="p-4">
                        {rem > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); setPayModal(s); }} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-[10px] hover:bg-sky-700 transition-colors flex items-center gap-1 shadow-sm">
                            <Plus size={12} /> دفعة
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {payModal && (
          <PayModal surgery={payModal} token={token}
            onClose={() => setPayModal(null)} onPaid={handlePaymentSuccess} />
        )}
      </AnimatePresence>

      <div className="hidden print:block">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  );
};

export default SurgeriesTab;
