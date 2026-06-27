import React, { useState } from 'react';
import { 
  X, History, FlaskConical, Eye, Pill, Printer, AlertCircle, Clock, Crown
} from 'lucide-react';

export default function PatientEMRModal({
  isOpen,
  onClose,
  patient,
  readOnly = false,
  historyLoading = false,
  patientHistory = [],
  selectedVisit = null,
  onSelectVisit,
  prescriptionItems = [],
  loadingPrescription = false,
  onPrintPrescription,
  onFinishVisit,
  renderActiveActions
}) {
  const [emrTab, setEmrTab] = useState('timeline');

  if (!isOpen || !patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
      <div className="bg-white rounded-3xl shadow-luxury w-full max-w-6xl h-[88vh] overflow-hidden flex flex-col border border-gray-100 relative animate-scale-in">
        
        {/* Sticky Red Warning Banner for ReadOnly */}
        {readOnly && (
          <div className="bg-gradient-to-r from-red-700 via-rose-600 to-red-700 text-white px-5 py-2.5 flex items-center gap-2 flex-shrink-0 shadow-md">
            <AlertCircle size={16} className="" />
            <span className="text-xs font-black tracking-wide">
              وضع القراءة فقط: هذا الملف الطبي مؤرشف للعرض المرجعي والطباعة فقط. يُحظر إجراء أي إدخالات أو طلبات جديدة.
            </span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-150 flex-shrink-0 bg-gray-50/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-black text-lg shadow">
              {patient.full_name?.charAt(0)}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                {patient.full_name}
                {readOnly ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-black">أرشيف</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg font-black flex items-center gap-0.5">
                    <Crown size={10} /> نشط
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                {patient.age ? `${patient.age} سنة` : '—'} · {patient.gender === 'male' ? 'ذكر' : 'أنثى'} · معرّف: #{patient.id || patient.patient_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!readOnly && (
              <div className="flex items-center gap-2">
                {renderActiveActions && renderActiveActions()}
                {onFinishVisit && (
                  <button
                    onClick={onFinishVisit}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-50 transition-all hover-lift"
                  >
                    إنهاء المعاينة وتأكيد الحالة
                  </button>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Core Modal Content with visit switcher */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Right: Visit selector (1/4 width) */}
          <div className="w-72 flex-shrink-0 bg-gray-50/80 border-l border-gray-150 flex flex-col overflow-hidden">
            <div className="p-4 bg-white border-b border-gray-150 flex items-center gap-2 text-xs font-black text-gray-600 flex-shrink-0">
              <Clock size={14} className="text-gray-400" />
              <span>الزيارات والتشخيصات السابقة</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-3 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : patientHistory.length === 0 ? (
                <p className="text-center text-gray-400 text-[10px] py-10 font-bold">لا توجد زيارات مسجلة.</p>
              ) : (
                patientHistory.map(v => {
                  const isSelected = selectedVisit?.id === v.id || selectedVisit?.visitId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => onSelectVisit && onSelectVisit(v)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-white border-slate-500 shadow-xs ring-1 ring-slate-400'
                          : 'bg-white border-gray-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-gray-800">{v.visit_number}</span>
                        <span className="text-[9px] font-black text-gray-400">{new Date(v.created_at).toLocaleDateString('ar')}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {v.is_exempt === 1 && <span className="bg-amber-100 text-amber-800 px-1 py-0.2 rounded text-[8px] font-black">معفي</span>}
                        {v.is_follow_up === 1 && <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded text-[8px] font-black">مراجعة</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Left: Detailed EMR view (3/4 width) */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* Tab bar */}
            <div className="flex border-b border-gray-150 p-2 gap-1 text-[11px] font-bold text-gray-500 flex-shrink-0 bg-gray-50/50">
              {[
                { id: 'timeline', label: 'الملخص التاريخي 📋', icon: History },
                { id: 'orders', label: 'الفحوصات المطلوبة 🧪', icon: FlaskConical },
                { id: 'results', label: 'نتائج المختبر والأشعة 🔬', icon: Eye },
                { id: 'prescription', label: 'الوصفة الطبية (الروشتة) 💊', icon: Pill }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEmrTab(tab.id)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                    emrTab === tab.id
                      ? 'bg-white text-slate-800 shadow-xs border border-gray-200'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scroll Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {!selectedVisit ? (
                <div className="text-center py-20 text-gray-400 text-xs font-bold">
                  قم باختيار زيارة من القائمة اليمنى لعرض تفاصيلها الطبية المؤرشفة.
                </div>
              ) : (
                <div>
                  {/* ── TIMELINE TAB ── */}
                  {emrTab === 'timeline' && (
                    <div className="space-y-4 modal-overlay-anim">
                      <h4 className="font-extrabold text-xs text-gray-800">📋 ملخص الزيارة ({selectedVisit.visit_number})</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 text-xs font-bold text-gray-600 space-y-2">
                          <p><strong>نوع الزيارة:</strong> {selectedVisit.is_follow_up ? 'مراجعة مجانية' : 'استشارة كشف جديد'}</p>
                          <p><strong>تاريخ التسجيل:</strong> {new Date(selectedVisit.created_at).toLocaleString('ar')}</p>
                          <p><strong>الحالة النهائية:</strong> <span className={selectedVisit.status === 'completed' ? 'text-emerald-700' : 'text-amber-600'}>{selectedVisit.status === 'completed' ? 'مكتملة ومؤرشفة ✓' : 'قيد المعالجة'}</span></p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 text-xs font-bold text-gray-600 space-y-2">
                          <p><strong>الجهة:</strong> {selectedVisit.entity === 'clinic' ? '🏥 العيادة' : '🏗️ المركز'}</p>
                          <p><strong>رسم الدخول:</strong> {selectedVisit.entry_fee || 0} ريال يمني</p>
                          <p><strong>الخصم المالي:</strong> {selectedVisit.discount_amount || 0} ريال يمني</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── ORDERS TAB ── */}
                  {emrTab === 'orders' && (
                    <div className="space-y-4 modal-overlay-anim">
                      <h4 className="font-extrabold text-xs text-gray-800">🧪 الفحوصات والخدمات المطلوبة في هذه الزيارة</h4>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-right text-[11px] font-bold">
                          <thead className="bg-gray-50 border-b border-gray-150 text-gray-500">
                            <tr>
                              <th className="p-3">اسم الفحص</th>
                              <th className="p-3">القسم</th>
                              <th className="p-3">الحالة</th>
                              <th className="p-3">السعر النهائي المعتمد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...(selectedVisit.labTests || []).map(r => ({ ...r, typeLabel: 'مختبر', labelColor: 'bg-blue-50 text-blue-700' })),
                              ...(selectedVisit.radiologyTests || []).map(r => ({ ...r, typeLabel: 'أشعة', labelColor: 'bg-rose-50 text-rose-700' })),
                              ...(selectedVisit.clinicalServices || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية', labelColor: 'bg-emerald-50 text-emerald-700' }))
                            ].length === 0 ? (
                              <tr>
                                <td colSpan="4" className="p-6 text-center text-gray-400 font-bold">لا يوجد أي فحوصات مسجلة لهذه الزيارة.</td>
                              </tr>
                            ) : (
                              [
                                ...(selectedVisit.labTests || []).map(r => ({ ...r, typeLabel: 'مختبر', labelColor: 'bg-blue-50 text-blue-700' })),
                                ...(selectedVisit.radiologyTests || []).map(r => ({ ...r, typeLabel: 'أشعة', labelColor: 'bg-rose-50 text-rose-700' })),
                                ...(selectedVisit.clinicalServices || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية', labelColor: 'bg-emerald-50 text-emerald-700' }))
                              ].map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                  <td className="p-3 font-extrabold text-gray-800">{item.name}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black ${item.labelColor}`}>
                                      {item.typeLabel}
                                    </span>
                                  </td>
                                  <td className={`p-3 font-bold ${item.status === 'completed' ? 'text-emerald-700' : 'text-amber-600'}`}>
                                    {item.status === 'completed' ? 'مكتمل ومؤرشف ✓' : 'قيد الانتظار ⏳'}
                                  </td>
                                  <td className="p-3 text-slate-700 font-black">{item.is_free ? 'معفي / 0 ريال' : `${item.final_price || 0} ريال`}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── RESULTS TAB ── */}
                  {emrTab === 'results' && (
                    <div className="space-y-4 modal-overlay-anim">
                      <h4 className="font-extrabold text-xs text-gray-800">🔬 نتائج وتقارير الزيارة المكتملة</h4>
                      {(() => {
                        const labs = (selectedVisit.labTests || []).filter(t => t.status === 'completed' || t.result_notes);
                        const rads = (selectedVisit.radiologyTests || []).filter(t => t.status === 'completed' || t.result_notes);
                        
                        if (labs.length === 0 && rads.length === 0) {
                          return <div className="text-center py-10 text-gray-400 text-xs font-bold">لا يوجد أي نتائج أو تقارير طبية مرفوعة لهذه الزيارة.</div>;
                        }

                        return (
                          <div className="space-y-4">
                            {labs.map((item, idx) => (
                              <div key={idx} className="bg-blue-50/20 border border-blue-100 rounded-2xl p-4 space-y-2">
                                <p className="font-black text-blue-800 text-xs">🧪 تحليل مخبري: {item.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold">تقرير فني المختبر:</p>
                                <p className="text-xs font-semibold text-gray-700 bg-white p-3 rounded-xl border shadow-sm leading-relaxed whitespace-pre-wrap">{item.result_notes || 'لم يسجل ملاحظات'}</p>
                              </div>
                            ))}
                            {rads.map((item, idx) => (
                              <div key={idx} className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 space-y-2">
                                <p className="font-black text-rose-800 text-xs">☢️ تقرير أشعة: {item.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold">تقرير الأخصائي:</p>
                                <p className="text-xs font-semibold text-gray-700 bg-white p-3 rounded-xl border shadow-sm leading-relaxed whitespace-pre-wrap">{item.result_notes || 'لم يسجل تقرير'}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── PRESCRIPTION TAB ── */}
                  {emrTab === 'prescription' && (
                    <div className="space-y-5 modal-overlay-anim">
                      <div className="flex justify-between items-center">
                        <h4 className="font-extrabold text-xs text-gray-800">💊 روشتة العلاج المؤرشفة للزيارة</h4>
                        {onPrintPrescription && (
                          <button
                            onClick={onPrintPrescription}
                            className="px-3.5 py-1.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-colors hover-lift"
                          >
                            <Printer size={14} /> طباعة الروشتة الرسمية
                          </button>
                        )}
                      </div>

                      <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-150">
                        <div className="patient-info mb-6 grid grid-cols-2 gap-4 text-xs font-bold text-gray-600 bg-white p-4 rounded-xl border border-gray-150 shadow-sm">
                          <div>
                            <p>اسم المريض: <span className="text-gray-800">{patient.full_name}</span></p>
                            <p>العمر والجنس: <span className="text-gray-800">{patient.age ? `${patient.age} سنة` : '—'} · {patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span></p>
                          </div>
                          <div>
                            <p>رقم الفاتورة: <span className="text-gray-800">{selectedVisit.visit_number}</span></p>
                            <p>التاريخ: <span className="text-gray-800">{new Date(selectedVisit.created_at).toLocaleDateString('ar')}</span></p>
                          </div>
                        </div>
                        
                        <h3 className="text-indigo-800 font-black text-sm pb-2 border-b border-gray-200 mb-4 flex items-center gap-1.5">
                          <Pill size={16}/> Rx الوصفة الدوائية
                        </h3>
                        
                        {loadingPrescription ? (
                          <div className="flex justify-center py-6">
                            <div className="w-6 h-6 border-3 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : prescriptionItems.length === 0 ? (
                          <p className="text-center text-gray-400 text-xs py-6 font-bold">لا يوجد أي أدوية مسجلة في هذه الروشتة.</p>
                        ) : (
                          <div className="space-y-4">
                            {prescriptionItems.map((item, idx) => (
                              <div key={idx} className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs leading-relaxed transition-all hover:border-indigo-100">
                                <p className="font-extrabold text-xs text-indigo-700">{idx+1}. {item.medication_name}</p>
                                <p className="text-[10px] text-gray-500 font-bold mt-1.5 flex flex-wrap gap-2">
                                  <span className="bg-gray-50 px-2 py-0.5 rounded border">الجرعة: {item.dosage || '—'}</span>
                                  {item.duration && <span className="bg-gray-50 px-2 py-0.5 rounded border">المدة: {item.duration}</span>}
                                  {item.instructions && <span className="bg-indigo-50/50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">تعليمات: {item.instructions}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
