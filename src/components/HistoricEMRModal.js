import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, Pencil, SendHorizontal, Clock, History, FlaskConical, Pill, Radiation, Printer, Maximize, Minimize, User, Phone, LayoutGrid, List } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";

export default function HistoricEMRModal({ patient, onClose, token, onEditPatient, onSendReview, sendingReview, hideFinancials }) {
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [emrTab, setEmrTab] = useState(hideFinancials ? 'orders' : 'timeline');
  const [ordersFilter, setOrdersFilter] = useState('lab');
  const [resultsFilter, setResultsFilter] = useState('lab');
  const [viewMode, setViewMode] = useState('list');
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Document preview modal states
  const [previewFile, setPreviewFile] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const openPreview = (file, name) => {
    setPreviewFile(file);
    setPreviewFileName(name);
    setIsPreviewModalOpen(true);
  };

  useEffect(() => {
    if (!patient) return;
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await axios.get(`/api/doctor/patient/${patient.id}/history`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setPatientHistory(res.data);
        if (res.data.length > 0) {
          handleSelectVisit(res.data[0]);
        }
      } catch (err) {
        toast.error('فشل تحميل السجل الطبي');
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [patient, token]);

  const handleSelectVisit = async (visit) => {
    setSelectedVisit(visit);
    setEmrTab(hideFinancials ? 'orders' : 'timeline');
    if (visit.prescription) {
      setLoadingPrescription(true);
      try {
        const res = await axios.get(`/api/doctor/prescription/${visit.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setPrescriptionItems(res.data || []);
      } catch (err) {
        toast.error('فشل تحميل الروشتة');
      } finally {
        setLoadingPrescription(false);
      }
    } else {
      setPrescriptionItems([]);
    }
  };

  const handlePrintPrescription = () => {
    const printContent = document.getElementById('print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = `
      <div dir="rtl" style="font-family: 'Cairo', sans-serif; padding: 20px;">
        <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">وصفة طبية - ${patient.full_name}</h2>
        ${printContent}
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  if (!patient) return null;

  return (
    <>
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 20 }}
          className={`bg-white shadow-2xl overflow-hidden flex flex-col border border-gray-100 relative transition-all duration-300 ${
            isFullscreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-6xl h-[88vh] rounded-3xl'
          }`}
        >
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-teal-700 text-white px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <Eye size={16} />
              <span className="text-xs font-black tracking-wide">وضع العرض الشامل: الأرشيف الطبي والزيارات السابقة</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
              </button>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={16}/></button>
            </div>
          </div>

          {/* Top Section: Patient & Visit Info */}
          <div className="p-5 border-b border-gray-100 flex-shrink-0 bg-white flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              {/* Right Side: Patient Profile */}
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 flex items-center justify-center font-black text-3xl border border-teal-200 shadow-sm flex-shrink-0">
                  {patient.full_name?.charAt(0)}
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="font-extrabold text-xl text-gray-900">{patient.full_name}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 font-bold">
                    <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">رقم الملف: {patient.id}</span>
                    {patient.phone && <span className="flex items-center gap-1"><Phone size={14}/> {patient.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-500">
                    <span className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><User size={14} className="inline-block -mt-0.5 mr-1"/> العمر: {patient.age} سنة</span>
                    <span className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">الجنس: {patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                  </div>
                </div>
              </div>
              
              {/* Left Side: Actions & Visit Context */}
              <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                <div className="flex gap-2">
                  {onEditPatient && (
                    <button onClick={() => onEditPatient(patient)} className="btn-secondary text-xs flex items-center gap-2 px-4 py-2 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100">
                      <Pencil size={14}/> تعديل
                    </button>
                  )}
                  {onSendReview && (
                    <button onClick={(e) => onSendReview(e, patient)} disabled={sendingReview === patient.id} className="btn-primary text-xs flex items-center gap-2 px-4 py-2 shadow-sm">
                      {sendingReview === patient.id ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <SendHorizontal size={14}/>}
                      إرسال للطبيب
                    </button>
                  )}
                </div>

                {selectedVisit && (
                  <div className={`flex flex-col p-3 rounded-xl border w-full min-w-[240px] ${selectedVisit.is_follow_up ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex justify-between items-center w-full mb-1.5 gap-2">
                      <span className="text-xs font-black text-gray-600 flex items-center gap-1">تفاصيل الزيارة المحددة</span>
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${selectedVisit.is_follow_up ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-200 text-blue-800'}`}>
                        {selectedVisit.is_follow_up ? 'مراجعة مجانية' : 'كشف جديد'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><Clock size={14}/> {new Date(selectedVisit.created_at).toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Previous Visits Row */}
            {patientHistory.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar mt-2">
                <span className="text-xs font-bold text-gray-400 flex-shrink-0 flex items-center gap-1"><History size={14}/> الزيارات:</span>
                {patientHistory.map((v, index) => {
                  const isSelected = selectedVisit?.id === v.id;
                  const isLatest = index === 0;
                  return (
                    <button key={v.id} onClick={() => handleSelectVisit(v)} 
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-md transform scale-105' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}
                    >
                      {isLatest ? 'الزيارة الأحدث' : 'زيارة سابقة'} · {new Date(v.created_at).toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
            <div className="flex border-b border-gray-200 px-6 pt-2 gap-6 text-sm font-bold text-gray-500 flex-shrink-0 bg-white">
              {(!hideFinancials ? [
                { id: 'timeline', label: 'المالية', icon: History },
                { id: 'orders', label: 'الفحوصات والخدمات', icon: FlaskConical },
                { id: 'results', label: 'النتائج الطبية', icon: Eye },
                { id: 'prescription', label: 'الروشتة', icon: Pill }
              ] : [
                { id: 'orders', label: 'الفحوصات والخدمات', icon: FlaskConical },
                { id: 'results', label: 'النتائج الطبية', icon: Eye },
                { id: 'prescription', label: 'الروشتة', icon: Pill }
              ]).map(tab => (
                <button key={tab.id} onClick={() => setEmrTab(tab.id)}
                  className={`flex items-center gap-2 pb-3 border-b-2 transition-all ${emrTab === tab.id ? 'border-teal-600 text-teal-700' : 'border-transparent hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {!selectedVisit ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <History size={48} className="mb-4" />
                  <p className="text-sm font-bold">اختر زيارة لعرض التفاصيل</p>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto w-full">
                  {emrTab === 'timeline' && !hideFinancials && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-2"><History size={16} className="text-teal-600"/> البيانات المالية للزيارة</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-xs text-gray-500 font-bold">رسم الدخول</span>
                            <span className="text-sm font-black text-emerald-700">{selectedVisit.entry_fee || 0} ريال</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-xs text-gray-500 font-bold">الخصم المالي</span>
                            <span className="text-sm font-black text-rose-600">{selectedVisit.discount_amount || 0} ريال</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {emrTab === 'orders' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-2"><FlaskConical size={16} className="text-teal-600"/> الفحوصات والخدمات المضافة</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={16}/></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={16}/></button>
                          </div>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            <button onClick={() => setOrdersFilter('lab')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${ordersFilter === 'lab' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>المختبر</button>
                            <button onClick={() => setOrdersFilter('radiology')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${ordersFilter === 'radiology' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>الأشعة</button>
                            <button onClick={() => setOrdersFilter('clinical')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${ordersFilter === 'clinical' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>الخدمات</button>
                          </div>
                        </div>
                      </div>
                      {(() => {
                         let items = [];
                         if (ordersFilter === 'lab') items = (selectedVisit.labTests || []).map(r => ({ ...r, t: 'مختبر', c: 'bg-teal-50 text-teal-700 border-teal-100' }));
                         else if (ordersFilter === 'clinical') items = (selectedVisit.clinicalServices || []).map(r => ({ ...r, t: 'خدمة سريرية', c: 'bg-emerald-50 text-emerald-700 border-emerald-100' }));
                         else if (ordersFilter === 'radiology') {
                           const rads = selectedVisit.radiologyTests || [];
                           const grouped = {};
                           const ungrouped = [];
                           rads.forEach(r => {
                             if (r.radiology_film_id) {
                               if (!grouped[r.radiology_film_id]) grouped[r.radiology_film_id] = { ...r, names: [r.name], t: 'أشعة', c: 'bg-rose-50 text-rose-700 border-rose-100' };
                               else grouped[r.radiology_film_id].names.push(r.name);
                             } else {
                               ungrouped.push({ ...r, names: [r.name], t: 'أشعة', c: 'bg-rose-50 text-rose-700 border-rose-100' });
                             }
                           });
                           items = [...Object.values(grouped), ...ungrouped];
                         }
                         
                         if (items.length === 0) return <div className="p-10 bg-white rounded-2xl border border-gray-100 text-center text-gray-400 font-bold text-sm shadow-sm">لا توجد نتائج مطابقة للفلتر</div>;
                         
                         if (viewMode === 'grid') {
                           return (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               {items.map((item, idx) => (
                                 <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col hover:border-teal-200 transition-colors">
                                   <div className="flex justify-between items-start mb-3">
                                     <span className="font-extrabold text-sm text-gray-800">{ordersFilter === 'radiology' ? item.names.join(' ، ') : item.name}</span>
                                     <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${item.c}`}>{item.t}</span>
                                   </div>
                                   {ordersFilter === 'radiology' && (
                                     <div className="flex gap-2 text-xs text-gray-500 font-bold mb-3">
                                       <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">{item.with_film ? 'مع فيلم' : 'بدون فيلم'}</span>
                                       {item.with_film === 1 && item.film_size && <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100">{item.film_size === 'large' ? 'فيلم كبير' : item.film_size === 'small' ? 'فيلم صغير' : ''}</span>}
                                     </div>
                                   )}
                                   {!hideFinancials && <div className="mt-auto pt-3 border-t border-gray-50 text-slate-700 font-black text-sm">{item.is_free ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">مجاني</span> : `${item.final_price || 0} ريال`}</div>}
                                 </div>
                               ))}
                             </div>
                           );
                         }

                         return (
                           <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                             <table className="w-full text-right text-xs">
                               <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold">
                                 <tr>
                                   <th className="p-4">الخدمة / الفحص</th>
                                   {ordersFilter === 'radiology' && <th className="p-4 w-32">نوع الفيلم</th>}
                                   {ordersFilter === 'radiology' && <th className="p-4 w-32">حجم الفيلم</th>}
                                   {!hideFinancials && <th className="p-4 w-32">التكلفة</th>}
                                 </tr>
                               </thead>
                               <tbody>
                                 {items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-extrabold text-gray-800">
                                      {ordersFilter === 'radiology' ? item.names.join(' ، ') : item.name}
                                    </td>
                                    {ordersFilter === 'radiology' && (
                                      <>
                                        <td className="p-4 text-xs font-bold text-gray-600">
                                          {item.with_film ? 'مع فيلم' : 'بدون فيلم'}
                                        </td>
                                        <td className="p-4 text-xs font-bold text-gray-600">
                                          {item.film_size === 'large' ? 'كبير' : item.film_size === 'small' ? 'صغير' : '-'}
                                        </td>
                                      </>
                                    )}
                                    {!hideFinancials && <td className="p-4 text-slate-700 font-black">{item.is_free ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">مجاني</span> : `${item.final_price || 0} ريال`}</td>}
                                  </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         );
                      })()}
                    </div>
                  )}

                  {emrTab === 'results' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-2"><Eye size={16} className="text-teal-600"/> تقارير النتائج الطبية</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={16}/></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={16}/></button>
                          </div>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            <button onClick={() => setResultsFilter('lab')} className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${resultsFilter === 'lab' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>المختبر</button>
                            <button onClick={() => setResultsFilter('radiology')} className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${resultsFilter === 'radiology' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>الأشعة</button>
                          </div>
                        </div>
                      </div>
                      
                      {(() => {
                        let items = [];
                        if (resultsFilter === 'lab') {
                          items = (selectedVisit.labTests || []).filter(t => t.status === 'completed' || t.result_notes || t.result_file);
                        } else {
                          const rads = (selectedVisit.radiologyTests || []).filter(t => t.status === 'completed' || t.result_notes || t.result_file);
                          const grouped = {};
                          const ungrouped = [];
                          rads.forEach(r => {
                            if (r.radiology_film_id) {
                              if (!grouped[r.radiology_film_id]) grouped[r.radiology_film_id] = { ...r, names: [r.name] };
                              else grouped[r.radiology_film_id].names.push(r.name);
                            } else {
                              ungrouped.push({ ...r, names: [r.name] });
                            }
                          });
                          items = [...Object.values(grouped), ...ungrouped];
                        }

                        if (items.length === 0) return <div className="p-10 bg-white rounded-2xl border border-gray-100 text-center text-gray-400 font-bold text-sm shadow-sm">لا توجد نتائج مسجلة</div>;

                        if (viewMode === 'grid') {
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {items.map((item, idx) => (
                                <div key={idx} className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col hover:border-teal-200 transition-colors">
                                  <div className="font-black text-teal-700 text-sm flex items-center justify-between gap-2 mb-3">
                                    <span className="flex items-center gap-2">
                                      {resultsFilter === 'lab' ? <FlaskConical size={16}/> : <Radiation size={16} className="text-rose-500"/>}
                                      <span className={resultsFilter === 'radiology' ? 'text-rose-700' : ''}>{resultsFilter === 'radiology' ? item.names.join(' ، ') : item.name}</span>
                                    </span>
                                    {item.result_file && (
                                      <div className="flex flex-wrap gap-1.5 justify-end">
                                        {(() => {
                                          try {
                                            const files = JSON.parse(item.result_file);
                                            if (Array.isArray(files)) {
                                              return files.map((file, fi) => (
                                                <button
                                                  key={fi}
                                                  onClick={() => openPreview(file.base64 || file, `${item.name} - ملف #${fi + 1}`)}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold transition-colors text-[10px] cursor-pointer"
                                                >
                                                  <Eye size={12}/> عرض ملف #{fi + 1}
                                                </button>
                                              ));
                                            }
                                          } catch {
                                            return (
                                              <button
                                                onClick={() => openPreview(item.result_file, `النتيجة - ${item.name}`)}
                                                className="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-blue-100 flex items-center gap-1 transition-colors cursor-pointer"
                                              >
                                                <Eye size={14}/> عرض الملف
                                              </button>
                                            );
                                          }
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`p-4 rounded-lg border text-xs font-bold text-gray-800 leading-relaxed whitespace-pre-wrap flex-1 ${resultsFilter === 'radiology' ? 'bg-rose-50/30 border-rose-100' : 'bg-teal-50/30 border-teal-100'}`}>{item.result_notes || 'لم يتم تسجيل ملاحظات.'}</div>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold">
                                <tr>
                                  <th className="p-4 w-1/3">الخدمة / الفحص</th>
                                  <th className="p-4 w-1/3">الملاحظات</th>
                                  <th className="p-4 w-1/3 text-center">تحميل النتيجة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4 font-extrabold text-gray-800">
                                      <div className="flex items-center gap-2">
                                        {resultsFilter === 'lab' ? <FlaskConical size={14} className="text-teal-500"/> : <Radiation size={14} className="text-rose-500"/>}
                                        {resultsFilter === 'radiology' ? item.names.join(' ، ') : item.name}
                                      </div>
                                    </td>
                                    <td className="p-4 text-gray-600 font-bold whitespace-pre-wrap">{item.result_notes || '-'}</td>
                                    <td className="p-4 text-center">
                                      {item.result_file ? (
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                        {(() => {
                                          try {
                                            const files = JSON.parse(item.result_file);
                                            if (Array.isArray(files)) {
                                              return files.map((file, fi) => (
                                                <button
                                                  key={fi}
                                                  onClick={() => openPreview(file.base64 || file, `${item.name} - ملف #${fi + 1}`)}
                                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold transition-colors text-[10px] cursor-pointer"
                                                >
                                                  <Eye size={12}/> عرض ملف #{fi + 1}
                                                </button>
                                              ));
                                            }
                                          } catch {
                                            return (
                                              <button
                                                onClick={() => openPreview(item.result_file, `النتيجة - ${item.name}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold transition-colors cursor-pointer"
                                              >
                                                <Eye size={14}/> عرض الملف
                                              </button>
                                            );
                                          }
                                        })()}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400 font-bold">لا يوجد ملف</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {emrTab === 'prescription' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Pill size={20}/>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-gray-800">الروشتة الموصوفة</h4>
                            <p className="text-xs text-gray-500 font-bold mt-1">قائمة الأدوية والتعليمات الخاصة بالزيارة</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-gray-50 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={16}/></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={16}/></button>
                          </div>
                          <button onClick={handlePrintPrescription} className="px-5 py-2.5 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-colors">
                            <Printer size={16} /> طباعة الروشتة
                          </button>
                        </div>
                      </div>
                      <div id="print-area" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        {loadingPrescription ? (
                          <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div></div>
                        ) : prescriptionItems.length === 0 ? (
                          <div className="text-center py-12 text-gray-400 text-sm font-bold">لا يوجد أدوية مسجلة لهذه الزيارة</div>
                        ) : viewMode === 'grid' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {prescriptionItems.map((item, idx) => (
                              <div key={idx} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col hover:border-teal-200 transition-colors">
                                <p className="font-extrabold text-sm text-teal-800 mb-3">{idx+1}. {item.medication_name}</p>
                                <p className="text-xs text-gray-600 font-bold flex flex-wrap gap-2 mt-auto">
                                  <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">الجرعة: {item.dosage}</span>
                                  {item.duration && <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">المدة: {item.duration}</span>}
                                  {item.instructions && <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">إرشادات: {item.instructions}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {prescriptionItems.map((item, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col hover:bg-gray-50 transition-colors">
                                  <p className="font-extrabold text-sm text-teal-800">{idx+1}. {item.medication_name}</p>
                                  <p className="text-xs text-gray-600 font-bold mt-3 flex flex-wrap gap-x-4 gap-y-2">
                                    <span className="bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">الجرعة: {item.dosage}</span>
                                    {item.duration && <span className="bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">المدة: {item.duration}</span>}
                                    {item.instructions && <span className="bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm">إرشادات: {item.instructions}</span>}
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
        </motion.div>
      </div>
    </AnimatePresence>

      <AnimatePresence>
        {isPreviewModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col border border-gray-100">
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                    <Eye size={18} className="text-blue-600 animate-pulse" /> معاينة التقرير الطبي
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-semibold">
                    {previewFileName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewFile("");
                    setPreviewFileName("");
                  }}
                  className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              {/* Viewer Area */}
              <div className="flex-1 bg-gray-100/50 p-6 overflow-hidden flex items-center justify-center min-h-0">
                {(() => {
                  if (!previewFile) return null;

                  const isPdf =
                    previewFile.startsWith("data:application/pdf") ||
                    previewFile.includes("pdf");

                  if (isPdf) {
                    return (
                      <iframe
                        src={previewFile}
                        className="w-full h-full rounded-2xl border border-gray-200 shadow-sm"
                        title="PDF Medical Report Preview"
                      />
                    );
                  } else {
                    return (
                      <div className="w-full h-full overflow-auto flex items-center justify-center p-2">
                        <img
                          src={previewFile}
                          className="max-w-full max-h-full object-contain rounded-2xl shadow-md border border-gray-200"
                          alt="Medical Image Preview"
                        />
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 flex justify-end">
                <button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewFile("");
                    setPreviewFileName("");
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer">
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
