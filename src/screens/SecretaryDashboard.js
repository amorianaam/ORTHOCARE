import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  RefreshCcw,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Printer,
  ChevronRight,
  ChevronLeft,
  Calendar,
  X,
  FileText,
  FlaskConical,
  Maximize,
  Minimize
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import useAuthStore from "../store/useAuthStore";
import HistoricEMRModal from "../components/HistoricEMRModal";

const getPatientLiveBadge = (v) => {
  const allRequests = [
    ...(v.labRequests || []).map((r) => ({ ...r, type: "lab" })),
    ...(v.radiologyRequests || []).map((r) => ({ ...r, type: "radiology" })),
    ...(v.clinicalRequests || []).map((r) => ({ ...r, type: "clinical" })),
  ];

  if (allRequests.some((r) => r.status === "pending_payment")) return "pending_payment";
  const activeExec = allRequests.filter((r) => r.type === "lab" || r.type === "radiology");
  if (activeExec.some((r) => r.status === "paid" || r.status === "in_progress")) return "in_progress";
  
  const hasLabOrRad = activeExec.length > 0;
  const allLabRadCompleted = activeExec.every((r) => r.status === "completed");
  
  if (hasLabOrRad && allLabRadCompleted) return "ready";
  if (allRequests.length > 0) return "tracking";
  return "normal";
};

const STATUS_CONFIG = {
  registered: { label: "تسجيل جديد", color: "bg-gray-100 text-gray-600", dot: "#9CA3AF" },
  pending_payment: { label: "قيد الدفع", color: "bg-amber-100 text-amber-700", dot: "#F59E0B" },
  awaiting_service_payment: { label: "دفع الخدمات", color: "bg-amber-100 text-amber-700", dot: "#F59E0B" },
  waiting: { label: "في قاعة الانتظار", color: "bg-sky-100 text-sky-700", dot: "#0EA5E9" },
  with_doctor: { label: "مع الطبيب", color: "bg-teal-100 text-teal-700", dot: "#2563EB" },
  awaiting_lab: { label: "في المختبر", color: "bg-purple-100 text-purple-700", dot: "#9333EA" },
  awaiting_radiology: { label: "في الأشعة", color: "bg-violet-100 text-violet-700", dot: "#7C3AED" },
  completed: { label: "مكتمل", color: "bg-emerald-100 text-emerald-700", dot: "#10B981" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700", dot: "#EF4444" },
  transferred_to_center: { label: "محول للعمليات", color: "bg-purple-100 text-purple-700", dot: "#9333EA" },
  post_surgery: { label: "ما بعد عملية", color: "bg-teal-100 text-teal-700", dot: "#4F46E5" },
};

const FILTERS = [
  { key: "all", label: "الكل", icon: Filter },
  { key: "waiting_doctor", label: "انتظار الدخول", icon: Clock },
  { key: "waiting_results", label: "انتظار النتائج", icon: FlaskConical },
  { key: "ready", label: "نتائج جاهزة", icon: AlertTriangle },
  { key: "with_doctor", label: "مع الطبيب", icon: Stethoscope },
  { key: "completed", label: "مكتمل", icon: CheckCircle2 },
];

export default function SecretaryDashboard() {
  const { token } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const navigate = useNavigate();
  
  // Modals
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
  const [isPrescriptionFullscreen, setIsPrescriptionFullscreen] = useState(false);
  
  // Polling ref
  const prevVisitsRef = useRef([]);

  const fetchData = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      // Fetch today's queue
      const res = await axios.get("/api/doctor/queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vData = Array.isArray(res.data) ? res.data : [];
      
      // Check for notifications
      if (isPolling && prevVisitsRef.current.length > 0) {
        vData.forEach(newV => {
          const oldV = prevVisitsRef.current.find(v => v.visitId === newV.visitId);
          if (oldV && oldV.status !== newV.status) {
            const pName = newV.full_name || 'مريض';
            if (newV.status === 'with_doctor') {
              toast.info(`المريض ${pName} دخل الآن لمعاينة الطبيب`, { icon: '👨‍⚕️' });
            } else if (newV.status === 'completed' && oldV.status === 'with_doctor') {
              toast.success(`الطبيب أنهى معاينة ${pName}، الطبيب جاهز!`, { icon: '🔔' });
            } else if (newV.status === 'waiting' && (oldV.status === 'awaiting_lab' || oldV.status === 'awaiting_radiology')) {
              toast.warning(`نتائج ${pName} جاهزة، يمكنه الدخول للطبيب الآن`, { icon: '⚠️' });
            }
          }
        });
      }
      
      prevVisitsRef.current = vData;
      setVisits(vData);

    } catch (err) {
      if (!isPolling) toast.error("فشل تحميل البيانات");
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter and derive data
  const processedVisits = visits.map(v => {
    const badge = getPatientLiveBadge(v);
    const isReady = (v.status === 'waiting' || v.status === 'awaiting_lab' || v.status === 'awaiting_radiology') && badge === 'ready';
    const isWithDoctor = v.status === 'with_doctor';
    const isCompleted = v.status === 'completed' || v.status === 'cancelled';
    
    // Waiting for results (doing procedures or pending payment)
    const isWaitingResults = !isReady && !isWithDoctor && !isCompleted && 
      (v.status.includes('awaiting') || v.status.includes('pending') || badge === 'tracking' || badge === 'in_progress');
      
    // Waiting for doctor (initial wait or basic wait without active procedures)
    const isWaitingDoctor = !isReady && !isWithDoctor && !isCompleted && !isWaitingResults;
    
    return {
      ...v,
      badge,
      isReady,
      isWithDoctor,
      isCompleted,
      isWaitingResults,
      isWaitingDoctor
    };
  });

  const filtered = processedVisits.filter(v => {
    const matchQuery = !query.trim() || 
      (v.full_name || '').toLowerCase().includes(query.toLowerCase()) || 
      (v.phone || '').includes(query);
      
    let matchFilter = true;
    if (activeFilter === "waiting_doctor") matchFilter = v.isWaitingDoctor;
    if (activeFilter === "waiting_results") matchFilter = v.isWaitingResults;
    if (activeFilter === "with_doctor") matchFilter = v.isWithDoctor;
    if (activeFilter === "completed") matchFilter = v.isCompleted;
    if (activeFilter === "ready") matchFilter = v.isReady;

    return matchQuery && matchFilter;
  });

  // Dashboard Stats
  const stats = {
    waitingDoctor: processedVisits.filter(v => v.isWaitingDoctor).length,
    waitingResults: processedVisits.filter(v => v.isWaitingResults).length,
    withDoctor: processedVisits.filter(v => v.isWithDoctor).length,
    ready: processedVisits.filter(v => v.isReady).length,
    completed: processedVisits.filter(v => v.isCompleted).length,
    total: processedVisits.length
  };

  const handlePrintPrescription = () => {
    if (!selectedVisit) return;
    const printContent = document.getElementById('print-area').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الروشتة</title>
          <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .rx-title { font-size: 20px; font-weight: bold; color: #0284c7; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            .item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; font-size: 18px; }
            .note { font-size: 14px; color: #666; margin-top: 5px; }
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
    <div className="h-[calc(100vh-100px)] flex flex-col gap-5" dir="rtl">
      {/* ── Page Header & Stats ── */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">لوحة تحكم الاستقبال</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">متابعة وإدارة تدفق المرضى بشكل لحظي</p>
          </div>
          <button onClick={() => fetchData()} disabled={loading} className="btn-secondary flex items-center gap-2">
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} /> تحديث
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="انتظار الدخول" value={stats.waitingDoctor} icon={Clock} color="sky" />
          <StatCard title="انتظار النتائج" value={stats.waitingResults} icon={FlaskConical} color="purple" />
          <StatCard title="نتائج جاهزة" value={stats.ready} icon={AlertTriangle} color="amber" />
          <StatCard title="مع الطبيب" value={stats.withDoctor} icon={Stethoscope} color="teal" />
          <StatCard title="مكتمل" value={stats.completed} icon={CheckCircle2} color="emerald" />
        </div>
      </div>

      {/* ── Main Content: Queue ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto no-scrollbar pb-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                  activeFilter === f.key
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-200"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <f.icon size={16} />
                {f.label}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-72">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              placeholder="ابحث بالاسم أو الهاتف..."
            />
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading && visits.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCcw size={32} className="animate-spin text-teal-500 opacity-50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-2">
                <Users size={32} className="text-gray-300" />
              </div>
              <p className="font-bold text-lg">لا توجد سجلات مطابقة</p>
              <p className="text-sm">لم يتم العثور على مرضى في هذه القائمة.</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((v, i) => {
                const cfg = STATUS_CONFIG[v.status] || { label: v.status || "غير معروف", color: "bg-gray-100 text-gray-600", dot: "#9CA3AF" };
                const isReady = v.isReady;
                return (
                  <motion.div
                    key={v.visitId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className={`bg-white p-4 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row md:items-center gap-4 ${
                      isReady ? 'border-amber-300 shadow-amber-100' : 'border-gray-100 hover:border-teal-200'
                    }`}
                  >
                    {/* Patient Identity */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                        isReady ? 'bg-amber-100 text-amber-700' : 'bg-teal-50 text-teal-700'
                      }`}>
                        {v.full_name?.charAt(0) || <User size={20} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{v.full_name || 'مريض غير معروف'}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-1">
                          <span>{v.age ? `${v.age} سنة` : ''} • {v.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                          <span className="flex items-center gap-1"><Phone size={12}/> {v.phone || 'لا يوجد هاتف'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Badges */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isReady && (
                        <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                          <AlertTriangle size={14} /> مستعد للدخول
                        </span>
                      )}
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-shrink-0 border-t md:border-t-0 md:border-r border-gray-100 pt-3 md:pt-0 md:pr-4 mt-1 md:mt-0">
                      {v.prescription && (
                        <button
                          onClick={() => setSelectedVisit(v)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Printer size={14} /> طباعة الروشتة
                        </button>
                      )}
                        <button 
                          onClick={() => setSelectedPatientForModal({ id: v.patient_id, full_name: v.full_name, age: v.age, gender: v.gender })}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-xs font-bold transition-colors">
                          ملف المريض <ChevronLeft size={14} />
                        </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Prescription Modal ── */}
      <AnimatePresence>
        {selectedVisit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
                isPrescriptionFullscreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-3xl max-h-[90vh] rounded-3xl'
              }`}
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3 text-teal-700">
                  <FileText size={24} />
                  <h2 className="text-lg font-black">معاينة الروشتة الدوائية</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsPrescriptionFullscreen(!isPrescriptionFullscreen)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                    {isPrescriptionFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                  <button onClick={() => setSelectedVisit(null)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {/* Invisible print area */}
                <div id="print-area" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                  <div className="header">
                    <h2 className="title text-teal-700 font-black">عيادة المفاصل والعظام - ORTHOCARE</h2>
                    <p style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>هاتف: 09XXXXXXXX | العنوان: صنعاء - شارع الستين</p>
                  </div>
                  <div className="patient-info">
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">اسم المريض:</p>
                      <p className="font-black text-gray-900 text-lg">{selectedVisit.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-500 mb-1">تاريخ الزيارة:</p>
                      <p className="font-black text-gray-900 text-lg">{new Date(selectedVisit.created_at).toLocaleDateString('ar')}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="rx-title flex items-center gap-2"><span className="text-3xl font-serif mr-1">Rx</span> الوصفة الطبية</h3>
                    {selectedVisit.prescription ? (
                      <div className="space-y-4 mt-6">
                        {typeof selectedVisit.prescription === 'string' 
                          ? <div className="text-lg font-medium whitespace-pre-wrap leading-relaxed">{selectedVisit.prescription}</div>
                          : Array.isArray(selectedVisit.prescription) 
                            ? selectedVisit.prescription.map((rx, idx) => (
                                <div key={idx} className="item flex justify-between items-start">
                                  <div>
                                    <div className="font-bold text-xl text-gray-900">{rx.medication_name}</div>
                                    <div className="note mt-1 text-gray-600 font-medium">{rx.dosage} - {rx.frequency}</div>
                                  </div>
                                  {rx.duration && <div className="text-sm font-bold bg-gray-100 px-3 py-1 rounded-lg text-gray-700">لمدة {rx.duration}</div>}
                                </div>
                              ))
                            : <div className="text-gray-500">تفاصيل الروشتة غير متوفرة بصيغة صحيحة.</div>
                        }
                      </div>
                    ) : (
                      <p className="text-gray-400 py-10 text-center font-bold">لم يتم تسجيل أدوية في هذه الزيارة</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button onClick={() => setSelectedVisit(null)} className="btn-secondary px-6">إغلاق</button>
                <button onClick={handlePrintPrescription} className="btn-primary px-8 flex items-center gap-2 bg-teal-600 hover:bg-teal-700">
                  <Printer size={18} /> طباعة الآن
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <HistoricEMRModal 
        patient={selectedPatientForModal} 
        onClose={() => setSelectedPatientForModal(null)} 
        token={token} 
        hideFinancials={true}
      />
    </div>
  );
}

// Sub-component
function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
}
