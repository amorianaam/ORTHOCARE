import React, { useState } from 'react';
import { Printer, Maximize2, Minimize2, X, History, CheckCircle2, ArrowUpRight, ArrowDownLeft, User } from 'lucide-react';

const CATEGORY_MAP = {
  entry_fee: 'رسم كشف',
  lab: 'مختبر',
  radiology: 'أشعة',
  surgery_payment: 'عملية',
  emergency: 'طوارئ',
  dental: 'أسنان',
  other: 'أخرى'
};

const cleanDescription = (desc) => {
  if (!desc) return 'بدون بيان';
  return desc.replace(/\{.*?\}/g, '').trim() || 'عام';
};

const FinancialRecordModal = ({ recordData, recordLoading, onClose }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center print:static print:inset-auto print:flex-col print:bg-white print:z-auto" dir="rtl">
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm print:hidden modal-overlay-anim" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div 
        className={`relative bg-white shadow-luxury w-full flex flex-col overflow-hidden print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none modal-content-anim border border-gray-100 ${isMaximized ? 'rounded-3xl max-w-6xl h-[88vh]' : 'rounded-3xl max-w-4xl max-h-[90vh]'}`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-600">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">السجل المالي للمريض</h2>
              {recordData?.patient && <p className="text-sm font-bold text-slate-500 mt-0.5">{recordData.patient.full_name} - {recordData.patient.phone || 'بدون هاتف'}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-100 transition-colors shadow-sm">
              <Printer size={16}/> طباعة
            </button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-500">
              {isMaximized ? <Minimize2 size={20}/> : <Maximize2 size={20}/>}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-red-500 hover:text-red-600"><X size={20}/></button>
          </div>
        </div>

        {/* Printable Header (Visible only in print) */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-black mb-2">ORTHOCARE SYSTEM - السجل المالي</h1>
          {recordData?.patient && (
            <div className="flex justify-between text-sm font-bold">
              <span>اسم المريض: {recordData.patient.full_name}</span>
              <span>رقم المريض: {recordData.patient.id}</span>
              <span>الهاتف: {recordData.patient.phone || '—'}</span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">تاريخ الطباعة: {new Date().toLocaleString('en-GB')}</p>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
          {recordLoading ? (
            <div className="flex justify-center py-12"><span className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full"/></div>
          ) : recordData ? (
            <div className="space-y-8">
              
              {/* Financial Transactions List */}
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4"><History size={20} className="text-slate-500"/> الحركات المالية والتسديدات</h3>
                
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden print:border-none print:rounded-none">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-gray-100 print:bg-transparent print:border-gray-800">
                      <tr>
                        <th className="px-4 py-3">تاريخ الحركة</th>
                        <th className="px-4 py-3">نوع الحركة</th>
                        <th className="px-4 py-3">الجهة</th>
                        <th className="px-4 py-3">البيان (اسم الخدمة)</th>
                        <th className="px-4 py-3">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                      {recordData.transactions.length === 0 && (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-500">لا توجد حركات مالية</td></tr>
                      )}
                      {recordData.transactions.map(t => (
                        <tr key={t.id} className={t.is_refund ? 'bg-red-50/30 print:bg-transparent' : ''}>
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{new Date(t.created_at).toLocaleString('en-GB')}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] ${t.is_refund ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {t.is_refund ? <ArrowUpRight size={12}/> : <ArrowDownLeft size={12}/>}
                              {t.is_refund ? 'استرداد' : 'تحصيل'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600">{CATEGORY_MAP[t.category] || t.category || 'عام'}</td>
                          <td className="px-4 py-3 text-gray-800 font-bold">{cleanDescription(t.description)} {!!t.is_refund && <span className="text-red-500 text-xs mr-2">({t.refund_reason})</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`font-black ${t.is_refund ? 'text-red-600' : 'text-gray-800'}`}>
                              {parseFloat(t.amount).toLocaleString('ar')} <span className="text-[10px] text-gray-400">YER</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-black text-slate-800 border-t-2 border-slate-200">
                      <tr>
                        <td colSpan="3" className="px-4 py-4 text-left">إجمالي الخدمات: {recordData.transactions.filter(t => !t.is_refund).length}</td>
                        <td className="px-4 py-4">الإجمالي النهائي:</td>
                        <td className="px-4 py-4 text-emerald-600">
                          {recordData.transactions.reduce((acc, t) => t.is_refund ? acc - parseFloat(t.amount) : acc + parseFloat(t.amount), 0).toLocaleString('ar')} YER
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Visits Summary */}
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4"><CheckCircle2 size={20} className="text-slate-500"/> سجل الزيارات</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                  {recordData.visits.map(v => (
                    <div key={v.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 print:border-gray-300 print:bg-transparent">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-700">زيارة #{v.visit_number}</span>
                        <span className="text-xs font-mono text-gray-500">{new Date(v.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-700">رسم الكشف: <span className="font-black">{v.entry_fee || 0} YER</span></p>
                      <p className="text-[11px] text-gray-500 mt-1 font-semibold">الرصيد المتبقي / الحالة: {v.status}</p>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FinancialRecordModal;
