import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Check, X,
  Clock, AlertCircle, Grid, List
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';
import InvoiceTemplate from '../../../components/InvoiceTemplate';

// ── Confirm Entry Fee Modal ─────────────────────────────────────────
const PayModal = ({ visit, onClose, onPaid, token }) => {
  const [amount, setAmount]   = useState('');
  const [saving, setSaving]   = useState(false);

  // Load default entry fee from system settings
  useEffect(() => {
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.entry_fee) setAmount(String(d.entry_fee)); })
      .catch(() => setAmount('25'));
  }, [token]);

  const handleConfirm = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return toast.error('أدخل مبلغاً صحيحاً');

    setSaving(true);
    try {
      const res = await fetch(`/api/cashier/visit/${visit.visit_id}/pay-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: parseFloat(amount), discountAmount: 0, discountReason: '' }),
      });
      const data = await res.json();
      if (res.ok) { 
        toast.success(data.message); 
        onPaid({
          patientName: visit.full_name,
          visitNumber: visit.visit_number,
          items: [{ description: 'رسم كشف طبي', total: parseFloat(amount) }],
          subtotal: parseFloat(amount),
          discount: 0,
          discountReason: '',
          totalPaid: parseFloat(amount),
          currency: 'YER'
        }); 
        onClose(); 
      }
      else toast.error(data.message);
    } catch (e) { toast.error('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  };

  const net = parseFloat(amount || 0).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-amber-100/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50"
          style={{background:'linear-gradient(135deg, #FFFBEB, #FEF3C7)'}}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/50 flex items-center justify-center">
              <CreditCard size={20} className="text-amber-700" />
            </div>
            <h3 className="font-black text-amber-900 text-lg">تأكيد دفع رسم الكشف</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        {/* Patient info */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              {visit.full_name?.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">{visit.full_name}</p>
              <p className="text-xs text-gray-500">{visit.age} سنة · {visit.visit_number}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">رسم الكشف (ريال يمني)</label>
            <input type="number" min="0" value={amount} readOnly disabled={true}
              className="input-base text-lg font-bold text-center bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>

          {/* Net amount */}
          <div className="rounded-2xl p-4 flex items-center justify-between bg-slate-900 shadow-inner">
            <span className="text-sm text-slate-300 font-bold">الصافي المحصّل:</span>
            <span className="text-3xl font-black text-emerald-400 tracking-tight">{net} <span className="text-sm font-bold text-emerald-600/50 uppercase tracking-wider">YER</span></span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-50 mt-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-[11px] font-bold transition-all shadow-sm">
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Check size={14} />}
              {saving ? 'جاري...' : 'تأكيد ودفع'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Cancel Modal ────────────────────────────────────────────────────
const CancelModal = ({ visit, onClose, onCancelled, token }) => {
  const [saving, setSaving] = useState(false);

  const handleCancel = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cashier/visit/${visit.visit_id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refundAmount: 0, reason: 'إلغاء قبل الدفع' }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); onCancelled(); onClose(); }
      else toast.error(data.message);
    } catch (e) { toast.error('تعذر الاتصال'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={26} className="text-red-600" />
        </div>
        <h3 className="font-bold text-gray-800 text-lg mb-2">إلغاء الزيارة</h3>
        <p className="text-sm text-gray-500 mb-6">
          هل أنت متأكد من إلغاء زيارة <span className="font-bold text-gray-800">{visit.full_name}</span>؟
          <br />هذا الإجراء لا يمكن التراجع عنه.
        </p>
        <div className="flex gap-3">
          <button onClick={handleCancel} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
            {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <X size={15} />}
            {saving ? 'جاري...' : 'تأكيد الإلغاء'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">تراجع</button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const EntryFeesTab = ({ viewMode = 'grid', setViewMode, onPatientClick }) => {
  const { token } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cashier/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch (e) { toast.error('فشل تحميل البيانات'); }
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

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">رسوم الدخول المعلقة</h2>
          <p className="text-sm text-gray-500 mt-0.5">{visits.length} مريض بانتظار السداد</p>
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
            <span className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full" />
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <Clock size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-bold">لا توجد رسوم دخول معلقة حالياً</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
            {visits.map((v, i) => (
              <motion.div key={v.visit_id}
                onClick={() => onPatientClick && onPatientClick(v.patient_id)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`cursor-pointer bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all flex flex-col justify-between p-5 h-44 relative overflow-hidden group border-amber-100`}
              >
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-lg shadow-inner border border-amber-100/50 flex-shrink-0">
                    {v.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-extrabold text-gray-900 leading-tight text-sm line-clamp-1">{v.full_name}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded-lg inline-block border border-amber-100">رقم الزيارة: {v.visit_number}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto relative z-10">
                  <button onClick={(e) => { e.stopPropagation(); setPayModal(v); }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-colors shadow-sm">
                    <CreditCard size={14} /> إصدار سند قبض
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setCancelModal(v); }}
                    className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="إلغاء التسجيل">
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                <tr>
                  <th className="p-4">المراجع</th>
                  <th className="p-4">تاريخ الزيارة</th>
                  <th className="p-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visits.map((v) => (
                  <tr key={v.visit_id} onClick={() => onPatientClick && onPatientClick(v.patient_id)} className="cursor-pointer hover:bg-slate-50/50 transition-colors">
                    
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xs border border-amber-100">
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
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setPayModal(v); }} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] hover:bg-amber-600 transition-colors flex items-center gap-1 shadow-sm">
                          <CreditCard size={12} /> تحصيل الرسوم
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setCancelModal(v); }} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="إلغاء">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {payModal && (
          <PayModal visit={payModal} token={token}
            onClose={() => setPayModal(null)} onPaid={handlePaymentSuccess} />
        )}
        {cancelModal && (
          <CancelModal visit={cancelModal} token={token}
            onClose={() => setCancelModal(null)} onCancelled={fetchData} />
        )}
      </AnimatePresence>

      <div className="hidden print:block">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  );
};

export default EntryFeesTab;
