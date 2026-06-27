import React, { useState, useEffect, useCallback, useMemo } from "react";
import PatientExaminationCard from "../../components/common/PatientExaminationCard";
import PatientEMRModal from "../../components/common/PatientEMRModal";
import {
  Activity,
  Plus,
  Search,
  Trash2,
  Clock,
  Layers,
  FlaskConical,
  Radiation,
  Pill,
  Heart,
  AlertTriangle,
  UserPlus,
  ChevronRight,
  Star,
  Eye,
  Save,
  Printer,
  X,
  CheckCircle,
  Crown,
  Stethoscope,
  ShieldAlert,
  Award,
  History,
  Maximize,
  Minimize,
  List,
  Grid,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import useAuthStore from "../../store/useAuthStore";
import { getSocket } from "../../utils/socket";
import taffyot from "../../utils/taffyot";
import ComboboxSelect from "../../components/ComboboxSelect";

export default function VIPCases() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  // Intake Form State
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "male",
    phone: "",
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Active VIP Queue & Selected Active Patient
  const [vipQueue, setVipQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(true);

  // EMR Active Tab
  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'prescription' | 'results' | 'history'

  // Catalogs & Selections
  const [catalogs, setCatalogs] = useState({
    lab: [],
    radiology: [],
    clinical: [],
    medications: [],
  });
  const [selectedServices, setSelectedServices] = useState([]);
  const [prescriptionItems, setPrescriptionItems] = useState([]);

  // Favorites
  const [favoriteTests, setFavoriteTests] = useState([]);
  const [favoriteMeds, setFavoriteMeds] = useState([]);
  const [preferredDosages, setPreferredDosages] = useState([]);
  const [bundles, setBundles] = useState([]);

  // Modals & Searching
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderModalMaximized, setIsOrderModalMaximized] = useState(false);
  const [orderModalViewMode, setOrderModalViewMode] = useState("grid"); // 'grid' | 'list'
  const [activeModalDept, setActiveModalDept] = useState("lab"); // 'lab' | 'radiology' | 'clinical' | 'favorites'
  const [activeModalCat, setActiveModalCat] = useState("");
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [rxMedQuery, setRxMedQuery] = useState("");
  const [submittingOrders, setSubmittingOrders] = useState(false);

  // Document preview modal states
  const [previewFile, setPreviewFile] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const openPreview = (file, name) => {
    setPreviewFile(file);
    setPreviewFileName(name);
    setIsPreviewModalOpen(true);
  };

  // Patient History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Data Fetching ───────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const res = await axios.get("/api/doctor/queue", { headers });
      if (Array.isArray(res.data)) {
        // Filter only exempt/VIP cases for today that are not completed/cancelled
        const vips = res.data.filter(
          (v) =>
            v.is_exempt === 1 &&
            v.status !== "completed" &&
            v.status !== "cancelled",
        );
        setVipQueue(vips);
      }
    } catch {
      toast.error("فشل تحميل قائمة الحالات المعفاة");
    } finally {
      setLoadingQueue(false);
    }
  }, [token]);

  const fetchCatalogs = useCallback(async () => {
    try {
      const [lab, rad, clin, meds] = await Promise.all([
        axios.get("/api/catalog/lab", { headers }),
        axios.get("/api/catalog/radiology", { headers }),
        axios.get("/api/admin/catalog/clinical-services", { headers }),
        axios.get("/api/admin/catalog/medications", { headers }),
      ]);
      setCatalogs({
        lab: lab.data || [],
        radiology: rad.data || [],
        clinical: clin.data || [],
        medications: meds.data || [],
      });
    } catch {
      console.error("Failed to load catalogs");
    }
  }, [token]);

  const fetchFavorites = useCallback(async () => {
    try {
      const [testsRes, medsRes, dosagesRes, bundlesRes] = await Promise.all([
        axios.get("/api/doctor/favorites/tests", { headers }),
        axios.get("/api/doctor/favorites/medications", { headers }),
        axios.get("/api/doctor/favorites/medications/preferred-dosages", {
          headers,
        }),
        axios.get("/api/doctor/favorites/bundles", { headers }),
      ]);
      setFavoriteTests(testsRes.data || []);
      setFavoriteMeds(medsRes.data || []);
      setPreferredDosages(dosagesRes.data || []);
      setBundles(bundlesRes.data || []);
    } catch (err) {
      console.error("Failed to load favorites", err);
    }
  }, [token]);

  const handleImportBundle = (bundle) => {
    if (!bundle || !bundle.items || bundle.items.length === 0) return;
    setSelectedServices((prev) => {
      let updated = [...prev];
      bundle.items.forEach((item) => {
        const id = item.test_id;
        const svcType = item.test_type;
        // Check if already in cart
        if (updated.some((s) => s.id === id && s.svcType === svcType)) return;

        const basePrice = item.price;
        const newSvc = {
          id: id,
          svcType: svcType,
          name: item.name,
          price: basePrice,
          price_with_film: svcType === "radiology" ? basePrice : undefined,
          price_without_film: item.price_without_film || undefined,
          withFilm: svcType === "radiology" ? true : undefined,
          discount_percentage: 100,
          is_free: true, // VIP cases are free!
          final_price: 0,
        };
        updated.push(newSvc);
      });
      return updated;
    });
    toast.success(`تم إدراج باقة "${bundle.name}" بنجاح في السلة`);
  };

  useEffect(() => {
    fetchQueue();
    fetchCatalogs();
    if (token) fetchFavorites();
  }, [fetchQueue, fetchCatalogs, fetchFavorites, token]);

  // Real-time synchronization
  useEffect(() => {
    const socket = getSocket();
    socket.on("patient:waiting", () => fetchQueue());
    return () => socket.off("patient:waiting");
  }, [fetchQueue]);

  // ─── Intake Form Handler ─────────────────────────────────────────
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return toast.warning("الاسم مطلوب");
    setSubmittingIntake(true);
    try {
      const res = await axios.post("/api/doctor/vip-intake", formData, {
        headers,
      });
      toast.success("تم تسجيل حالة الإعفاء المباشرة وبدء المعاينة");
      setFormData({ fullName: "", age: "", gender: "male", phone: "" });
      fetchQueue();
      // Select the patient immediately
      if (res.data && res.data.visit) {
        handleSelectPatient(res.data.visit);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "خطأ في حفظ الحالة");
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleSelectPatient = async (visit) => {
    setActive(visit);
    setSelectedServices([]);
    setPrescriptionItems([]);
    setActiveTab("orders");

    // Load Patient History
    try {
      setHistoryLoading(true);
      const res = await axios.get(
        `/api/doctor/patient/${visit.patient_id}/history`,
        { headers },
      );
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }

    // Load prescription
    try {
      const prescRes = await axios.get(
        `/api/doctor/visit/${visit.visitId}/prescription`,
        { headers },
      );
      if (prescRes.data && prescRes.data.items) {
        setPrescriptionItems(prescRes.data.items);
      }
    } catch {
      setPrescriptionItems([]);
    }
  };

  const handleCloseVisit = async () => {
    if (!active) return;
    try {
      await axios.put(
        `/api/doctor/visit/${active.visitId}/close`,
        {},
        { headers },
      );
      toast.success("تم إنهاء وإغلاق حالة الإعفاء بنجاح");
      fetchQueue();
      setActive(null);
    } catch {
      toast.error("فشل إغلاق الحالة");
    }
  };

  // ─── EMR Orders handlers ─────────────────────────────────────────
  const addService = (item) => {
    const isRadiology = item.svcType === "radiology";
    const basePrice = isRadiology ? item.price_with_film : item.price;
    const newSvc = {
      ...item,
      price: basePrice,
      withFilm: isRadiology ? true : undefined,
      discount_percentage: 0,
      is_free: true, // Auto-exempt/Free for VIP!
      final_price: 0,
    };
    setSelectedServices((prev) => [...prev, newSvc]);
  };

  const updateService = (idx, field, value) => {
    setSelectedServices((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const updated = { ...s, [field]: value };

        // If setting withFilm for radiology, adjust base price
        if (field === "withFilm" && s.svcType === "radiology") {
          updated.price = value ? s.price_with_film : s.price_without_film || 0;
        }

        // Re-calculate price (always 0 since it is free)
        if (updated.is_free) {
          updated.final_price = 0;
          updated.discount_percentage = 100;
        } else {
          const disc = parseFloat(updated.discount_percentage) || 0;
          const discountAmt = (updated.price * disc) / 100;
          updated.final_price = updated.price - discountAmt;
        }
        return updated;
      }),
    );
  };

  const removeService = (idx) => {
    setSelectedServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleFavoriteTest = async (item, testType) => {
    const isFav = favoriteTests.some(
      (f) => f.test_id === item.id && f.test_type === testType,
    );
    try {
      if (isFav) {
        await axios.delete(
          `/api/doctor/favorites/tests/type/${testType}/id/${item.id}`,
          { headers },
        );
        setFavoriteTests((prev) =>
          prev.filter(
            (f) => !(f.test_id === item.id && f.test_type === testType),
          ),
        );
        toast.info("تمت الإزالة من المفضلة");
      } else {
        await axios.post(
          "/api/doctor/favorites/tests",
          { testId: item.id, testType },
          { headers },
        );
        setFavoriteTests((prev) => [
          ...prev,
          { test_id: item.id, test_type: testType },
        ]);
        toast.success("تمت الإضافة للمفضلة");
      }
    } catch {
      toast.error("فشل معالجة المفضلة");
    }
  };

  const handleSubmitOrders = async () => {
    if (selectedServices.length === 0) return toast.warning("السلة فارغة");
    setSubmittingOrders(true);
    try {
      const payload = {
        labTests: selectedServices.filter((s) => s.svcType === "lab"),
        radiologyTests: selectedServices.filter(
          (s) => s.svcType === "radiology",
        ),
        clinicalServices: selectedServices.filter(
          (s) => s.svcType === "clinical",
        ),
      };
      await axios.post(
        `/api/doctor/visit/${active.visitId}/order-services`,
        payload,
        { headers },
      );
      toast.success("تم طلب الخدمات بنجاح وتجاوز الكاشير للتنفيذ المباشر!");
      setSelectedServices([]);
      setIsOrderModalOpen(false);

      // Refresh active patient object to show updated orders
      const queueRes = await axios.get("/api/doctor/queue", { headers });
      if (Array.isArray(queueRes.data)) {
        const updatedActive = queueRes.data.find(
          (v) => v.visitId === active.visitId,
        );
        if (updatedActive) {
          setActive(updatedActive);
        }
      }
    } catch {
      toast.error("خطأ في إرسال طلبات الخدمات");
    } finally {
      setSubmittingOrders(false);
    }
  };

  // ─── E-Prescription handlers ──────────────────────────────────────
  const addPrescriptionItem = () => {
    setPrescriptionItems((prev) => [
      ...prev,
      { medication_name: "", dosage: "", timing: "", duration: "", instructions: "" },
    ]);
  };

  const updateRxItem = (idx, field, value) => {
    setPrescriptionItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  const saveRxItemToFavorites = async (medName, dosage) => {
    try {
      await Promise.all([
        axios.post(
          "/api/doctor/favorites/medications",
          { name: medName },
          { headers },
        ),
        axios.post(
          "/api/doctor/favorites/medications/preferred-dosages",
          { dosage },
          { headers },
        ),
      ]);
      fetchFavorites();
      toast.success("تم حفظ الدواء والجرعة في المفضلة");
    } catch {
      toast.error("خطأ في الحفظ في المفضلة");
    }
  };

  const handleSavePrescription = async () => {
    const valid = prescriptionItems.filter((item) =>
      item.medication_name.trim(),
    );
    if (valid.length === 0) return toast.warning("الوصفة فارغة");

    // Custom dosage check removed per user request

    try {
      await axios.post(
        `/api/doctor/visit/${active.visitId}/prescription`,
        { items: valid },
        { headers },
      );
      toast.success("تم حفظ الوصفة وإرسال نسخة للطباعة");
    } catch {
      toast.error("خطأ في حفظ الوصفة");
    }
  };

  // Autocomplete helpers
  const rxMedOptions = useMemo(
    () => catalogs.medications.map((m) => m.name),
    [catalogs.medications],
  );

  const categorizedCatalog = useMemo(() => {
    const groupCatalog = (items, type) => {
      const map = {};
      (items || []).forEach((item) => {
        const catName = item.category_name || (type === "lab" ? "تحاليل عامة" : type === "radiology" ? "أشعة عامة" : "خدمات عامة");
        if (!map[catName]) {
          map[catName] = { name: catName, type, items: [] };
        }
        map[catName].items.push({ ...item, svcType: type });
      });
      return Object.values(map);
    };

    return {
      lab: groupCatalog(catalogs.lab, 'lab'),
      radiology: groupCatalog(catalogs.radiology, 'radiology'),
      clinical: groupCatalog(catalogs.clinical, 'clinical'),
    };
  }, [catalogs]);

  useEffect(() => {
    if (activeModalDept === 'favorites') {
      setActiveModalCat("");
    } else {
      const deptCats = categorizedCatalog[activeModalDept] || [];
      if (deptCats.length > 0) {
        const exists = deptCats.some(c => c.name === activeModalCat);
        if (!exists) {
          setActiveModalCat(deptCats[0].name);
        }
      } else {
        setActiveModalCat("");
      }
    }
  }, [activeModalDept, categorizedCatalog, activeModalCat]);

  const allDeptItems = useMemo(() => {
    if (activeModalDept === 'favorites') {
      return [
        ...catalogs.lab.filter(item => favoriteTests.some(f => f.test_id === item.id && f.test_type === 'lab')).map(item => ({ ...item, svcType: 'lab' })),
        ...catalogs.radiology.filter(item => favoriteTests.some(f => f.test_id === item.id && f.test_type === 'radiology')).map(item => ({ ...item, svcType: 'radiology' })),
        ...catalogs.clinical.filter(item => favoriteTests.some(f => f.test_id === item.id && f.test_type === 'clinical')).map(item => ({ ...item, svcType: 'clinical' })),
      ];
    }
    return [
      ...(activeModalDept === 'lab' ? catalogs.lab.map(item => ({ ...item, svcType: 'lab' })) : []),
      ...(activeModalDept === 'radiology' ? catalogs.radiology.map(item => ({ ...item, svcType: 'radiology' })) : []),
      ...(activeModalDept === 'clinical' ? catalogs.clinical.map(item => ({ ...item, svcType: 'clinical' })) : []),
    ];
  }, [activeModalDept, catalogs, favoriteTests]);

  const displayItems = useMemo(() => {
    if (modalSearchTerm) {
      return allDeptItems.filter(item => 
        item.name?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        (item.category_name && item.category_name.toLowerCase().includes(modalSearchTerm.toLowerCase()))
      );
    }
    if (activeModalDept === 'favorites') {
      return allDeptItems;
    }
    const currentCatObj = (categorizedCatalog[activeModalDept] || []).find(c => c.name === activeModalCat);
    return currentCatObj ? currentCatObj.items : [];
  }, [modalSearchTerm, activeModalDept, allDeptItems, categorizedCatalog, activeModalCat]);

  // ─── Render Helper ───────────────────────────────────────────────
  const getCompletedResults = () => {
    const completedLabs = (active?.labRequests || []).filter(
      (r) => r.status === "completed",
    );
    const completedRads = (active?.radiologyRequests || []).filter(
      (r) => r.status === "completed",
    );
    return {
      completedLabs,
      completedRads,
      hasResults: completedLabs.length > 0 || completedRads.length > 0,
    };
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden border border-indigo-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -ml-20 -mb-20"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg text-white">
              <Crown size={28} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-white">
                مساحة المعاينة المباشرة
              </h1>
              <p className="text-indigo-200 text-xs font-bold mt-1">
                تخطي المحاسب لاجراء الخدمات بدون دفع
              </p>
            </div>
          </div>
          <div className="bg-indigo-950/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-indigo-800 text-left">
            <span className="text-[10px] block font-black text-indigo-300">
              إجمالي حالات اليوم
            </span>
            <span className="text-xl font-black text-amber-400">
              {vipQueue.length} حالة
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Intake & Active Queue List */}
        <div className="space-y-6">
          {/* Direct Intake Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-black text-sm text-gray-800 flex items-center gap-2 pb-3 border-b border-gray-50">
              <UserPlus className="text-indigo-600" size={18} /> اضافات خارجية
            </h3>
            <form onSubmit={handleIntakeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">
                  الاسم الكامل *
                </label>
                <input
                  type="text"
                  placeholder="اسم المريض الرباعي..."
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="input-base text-xs font-semibold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    العمر *
                  </label>
                  <input
                    type="number"
                    placeholder="العمر..."
                    value={formData.age}
                    onChange={(e) =>
                      setFormData({ ...formData, age: e.target.value })
                    }
                    className="input-base text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    الجنس
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                    className="input-base text-xs font-semibold">
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1">
                  الهاتف
                </label>
                <input
                  type="text"
                  placeholder="09..."
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="input-base text-xs font-semibold"
                />
              </div>
              <button
                type="submit"
                disabled={submittingIntake}
                className="w-full bg-gradient-to-r from-indigo-700 to-indigo-600 hover:from-indigo-800 hover:to-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5">
                {submittingIntake ? (
                  <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Plus size={16} /> بدء المعاينة المباشرة
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Active Queue List */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-black text-sm text-gray-800 flex items-center gap-2 pb-3 border-b border-gray-50 mb-3">
              <Clock className="text-amber-500" size={18} /> الحالات النشطة
              اليوم
            </h3>
            {loadingQueue ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : vipQueue.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                لا يوجد حالات إعفاء معلقة حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vipQueue.map((item) => (
                  <PatientExaminationCard
                    key={item.visitId}
                    patient={item}
                    onClick={() => handleSelectPatient(item)}
                    isSelected={active?.visitId === item.visitId}
                    isVIP={true}
                    actionText="إجراء معاينة"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        
      <PatientEMRModal
        isOpen={!!active}
        onClose={() => setActive(null)}
        patient={active}
        readOnly={false}
        historyLoading={historyLoading}
        patientHistory={history}
        selectedVisit={active}
        onSelectVisit={handleSelectPatient}
        prescriptionItems={prescriptionItems}
        onFinishVisit={handleCloseVisit}
        renderActiveActions={() => (
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center gap-1 shadow-md shadow-indigo-50 hover-lift"
          >
            <Plus size={16} /> طلب فحوصات وإجراءات
          </button>
        )}
      />
      </div>
      {/* ── SMART ORDER MODAL ── */}
      {isOrderModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl">
            <div
              className={`bg-white shadow-2xl flex flex-col border border-indigo-150 animate-fadeIn transition-all duration-300 ${
                isOrderModalMaximized
                  ? "w-screen h-screen rounded-none"
                  : "w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden"
              }`}>
              
              {/* 1. Modal Header */}
              <div className="flex justify-between items-center p-3.5 border-b border-indigo-100 flex-shrink-0 bg-gradient-to-r from-indigo-50/50 via-white to-amber-50/20">
                <div>
                  <h3 className="font-black text-lg text-indigo-950 flex items-center gap-2">
                    <Crown size={22} className="text-amber-500 animate-pulse" />
                    <span>كتالوج الخدمات والفحوصات الطبية (VIP EMR)</span>
                  </h3>
                  <p className="text-[11px] text-indigo-900/60 mt-1 font-bold">
                    نافذة اختيار الفحوصات المتكاملة بخصم 100% لمرضى الإعفاء وكبار الشخصيات
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 ml-3">
                    <button
                      onClick={() => setOrderModalViewMode("grid")}
                      className={`p-1.5 rounded-lg transition-all ${
                        orderModalViewMode === "grid" ? "bg-white shadow-sm text-indigo-650" : "text-gray-400 hover:text-indigo-500"
                      }`}
                      title="عرض شبكي">
                      <Grid size={16} />
                    </button>
                    <button
                      onClick={() => setOrderModalViewMode("list")}
                      className={`p-1.5 rounded-lg transition-all ${
                        orderModalViewMode === "list" ? "bg-white shadow-sm text-indigo-650" : "text-gray-400 hover:text-indigo-500"
                      }`}
                      title="عرض قائمة">
                      <List size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => setIsOrderModalMaximized(!isOrderModalMaximized)}
                    className="p-2 rounded-xl bg-indigo-50 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 transition-all">
                    {isOrderModalMaximized ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* 2. Selections Basket (سلة الاختيارات - الأعلى) */}
              <div className="bg-indigo-50/40 p-4 border-b border-indigo-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    🛒 الفحوصات المحددة حالياً ({selectedServices.length}):
                  </span>
                  {selectedServices.length > 0 && (
                    <button
                      onClick={() => setSelectedServices([])}
                      className="text-[10px] text-red-500 hover:text-red-700 font-bold bg-white border border-red-200 px-2 py-1 rounded-lg transition-all shadow-2xs">
                      مسح السلة بالكامل
                    </button>
                  )}
                </div>
                {selectedServices.length === 0 ? (
                  <div className="text-gray-400 text-xs font-semibold py-3 text-center bg-white/80 rounded-2xl border border-dashed border-indigo-150 shadow-2xs">
                    لم تقم بتحديد أي خدمة أو فحص للطلب بعد. اختر من التصنيفات والتبويبات أدناه.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1 scrollbar-thin">
                    {selectedServices.map((svc, idx) => (
                      <div key={idx} className="bg-white border border-indigo-200 hover:border-red-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xs text-[11px] font-black transition-all">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          svc.svcType === 'lab' ? 'bg-indigo-500' : svc.svcType === 'radiology' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span className="text-gray-800">{svc.name}</span>
                        <span className="text-indigo-700 font-extrabold font-sans">(0 ريال - معفي)</span>
                        <button 
                          onClick={() => removeService(idx)} 
                          className="text-gray-400 hover:text-red-600 font-black cursor-pointer mr-1 transition-colors"
                          title="إزالة من السلة"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Department Top Tabs Bar */}
              <div className="bg-indigo-50/20 p-3 border-b border-indigo-100 flex-shrink-0 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2">
                  {[
                    { id: 'lab', label: 'التحاليل الطبية 🧪', activeClass: 'bg-indigo-650 text-white shadow-md shadow-indigo-100' },
                    { id: 'radiology', label: 'الأشعة التشخيصية ☢️', activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-100' },
                    { id: 'clinical', label: 'الخدمات السريرية 🩺', activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-100' },
                    { id: 'favorites', label: 'المفضلة ⭐', activeClass: 'bg-purple-650 text-white shadow-md shadow-purple-100' },
                  ].map((tab) => {
                    const isActive = activeModalDept === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setActiveModalDept(tab.id);
                          setModalSearchTerm("");
                        }}
                        className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                          isActive
                            ? tab.activeClass + " border-transparent"
                            : "bg-white text-gray-600 hover:bg-indigo-50 border-gray-200 hover:border-indigo-300"
                        }`}>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Bundles Import inside active tab */}
                {bundles.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none max-w-sm md:max-w-md">
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg whitespace-nowrap">
                      📦 الباقات الجاهزة:
                    </span>
                    <div className="flex gap-1">
                      {bundles.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleImportBundle(b)}
                          className="px-2 py-1 bg-white hover:bg-indigo-50 text-gray-700 border border-gray-200 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 shadow-3xs">
                          <span>{b.name}</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1 rounded-sm">
                            {b.items?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Explorer Controls: Keyword Search */}
              <div className="py-2 px-4 border-b border-indigo-50 flex-shrink-0 bg-white">
                <div className="relative max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                  <input
                    type="text"
                    placeholder={`بحث سريع بالاسم أو التصنيف (مثال: CBC، أشعة صدر)...`}
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="pr-9 pl-8 text-[11px] py-1.5 font-bold w-full bg-indigo-50/20 hover:bg-indigo-50/40 focus:bg-white border border-indigo-100 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-xl outline-none transition-all shadow-sm"
                  />
                  {modalSearchTerm && (
                    <button
                      onClick={() => setModalSearchTerm("")}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-0.5 rounded-full text-[9px] transition-all">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* 5. Modal Core Explorer (Middle) */}
              <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                
                {/* 5A. Left Categories Sidebar Selector (Hidden on search or favorites) */}
                {!modalSearchTerm && activeModalDept !== 'favorites' && (
                  <div className="w-64 border-l border-indigo-100 overflow-y-auto flex-shrink-0 bg-indigo-50/10 p-4 space-y-1.5 scrollbar-thin">
                    <span className="text-[10px] font-black text-indigo-400 block mb-2 px-2">التصنيفات المتاحة:</span>
                    {(categorizedCatalog[activeModalDept] || []).length === 0 ? (
                      <div className="text-gray-400 text-[11px] font-bold p-4 text-center">لا توجد تصنيفات مدرجة</div>
                    ) : (
                      (categorizedCatalog[activeModalDept] || []).map((cat) => {
                        const isActive = activeModalCat === cat.name;
                        const CatIcon = cat.type === 'lab' ? FlaskConical : cat.type === 'radiology' ? Radiation : Layers;
                        
                        // Select border colors and text classes based on active state and department
                        let activeBtnStyle = "bg-indigo-650 text-white shadow-md shadow-indigo-100";
                        if (activeModalDept === 'radiology') activeBtnStyle = "bg-amber-600 text-white shadow-md shadow-amber-100";
                        if (activeModalDept === 'clinical') activeBtnStyle = "bg-emerald-600 text-white shadow-md shadow-emerald-100";

                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => setActiveModalCat(cat.name)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-right text-xs font-black transition-all ${
                              isActive
                                ? activeBtnStyle
                                : "bg-white text-gray-700 hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <CatIcon size={14} className={isActive ? "text-white" : "text-indigo-400"} />
                              <span className="truncate max-w-[130px]">{cat.name}</span>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              isActive ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-500 border border-indigo-100"
                            }`}>
                              {cat.items?.length || 0}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 5B. Main Explorer Content Area (Right Grid) */}
                <div className="flex-1 flex flex-col overflow-hidden p-5">
                  {(() => {
                    let activeTitle = "";
                    if (modalSearchTerm) {
                      activeTitle = `نتائج البحث المطابقة لـ "${modalSearchTerm}" في قسم ${
                        activeModalDept === 'lab' ? 'التحاليل' : activeModalDept === 'radiology' ? 'الأشعة' : activeModalDept === 'clinical' ? 'الخدمات السريرية' : 'المفضلة'
                      }`;
                    } else if (activeModalDept === 'favorites') {
                      activeTitle = "الفحوصات الطبية المفضلة ⭐";
                    } else {
                      activeTitle = `تصنيف: ${activeModalCat || "تحميل الفحوصات..."}`;
                    }

                    if (displayItems.length === 0) {
                      return (
                        <div className="text-center py-16 text-gray-400 flex flex-col items-center justify-center h-full">
                          <Layers className="mx-auto text-gray-300 mb-2 animate-bounce" size={40} />
                          <p className="text-xs font-black">لا توجد فحوصات أو خدمات مطابقة للبحث أو القسم المختار</p>
                        </div>
                      );
                    }

                    // Toggle ALL button check
                    const allSelected = displayItems.every(item =>
                      selectedServices.some(s => s.id === item.id && s.svcType === item.svcType)
                    );

                    const handleToggleAll = () => {
                      if (allSelected) {
                        setSelectedServices(prev =>
                          prev.filter(s => !displayItems.some(f => f.id === s.id && f.svcType === s.svcType))
                        );
                      } else {
                        const toAdd = displayItems
                          .filter(f => !selectedServices.some(s => s.id === f.id && s.svcType === f.svcType))
                          .map(f => {
                            const basePrice = f.svcType === "radiology" ? f.price_with_film : f.price;
                            return {
                              ...f,
                              price: basePrice,
                              withFilm: f.svcType === "radiology" ? true : undefined,
                              final_price: basePrice,
                              discount_percentage: 0,
                              is_free: false,
                            };
                          });
                        setSelectedServices(prev => [...prev, ...toAdd]);
                      }
                    };

                    return (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Section Header with dynamic category title and ALL toggler */}
                        <div className="flex justify-between items-center pb-3 border-b border-indigo-100 flex-shrink-0 mb-4 text-[11px] font-black text-indigo-400">
                          <span className="flex items-center gap-1">
                            <Activity size={13} className="text-indigo-500" />
                            {activeTitle} ({displayItems.length} عنصر)
                          </span>
                          {!modalSearchTerm && activeModalDept !== 'favorites' && (
                            <button
                              type="button"
                              onClick={handleToggleAll}
                              className="text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-650 px-3 py-1.5 rounded-xl transition-all border border-indigo-200 flex items-center gap-1 cursor-pointer">
                              <span>ALL</span>
                              <span>{allSelected ? "إلغاء تحديد الكل" : "تحديد وتعبئة الكل"}</span>
                            </button>
                          )}
                        </div>

                        {/* Services Grid */}
                        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                          <div className={`gap-3 ${orderModalViewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col"}`}>
                            {displayItems.map((item) => {
                              const isChecked = selectedServices.some(
                                (s) => s.id === item.id && s.svcType === item.svcType
                              );
                              const isStarred = favoriteTests.some(
                                (f) => f.test_id === item.id && f.test_type === item.svcType
                              );
                              const itemPrice = item.svcType === "radiology" ? item.price_with_film : item.price;
                              const CatIcon = item.svcType === 'lab' ? FlaskConical : item.svcType === 'radiology' ? Radiation : Stethoscope;

                              let checkedBorderClass = "bg-indigo-50/40 border-indigo-400 shadow-sm";
                              if (item.svcType === 'radiology') checkedBorderClass = "bg-amber-50/40 border-amber-400 shadow-sm";
                              if (item.svcType === 'clinical') checkedBorderClass = "bg-emerald-50/40 border-emerald-400 shadow-sm";

                              return (
                                <div
                                  key={`${item.svcType}_${item.id}`}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedServices(prev =>
                                        prev.filter(s => !(s.id === item.id && s.svcType === item.svcType))
                                      );
                                    } else {
                                      // Force exemption logic for VIP patients in cart addition
                                      const basePrice = item.svcType === "radiology" ? item.price_with_film : item.price;
                                      const newSvc = {
                                        ...item,
                                        price: basePrice,
                                        withFilm: item.svcType === "radiology" ? true : undefined,
                                        final_price: basePrice,
                                        discount_percentage: 0,
                                        is_free: false,
                                      };
                                      setSelectedServices((prev) => {
                                        if (prev.find((s) => s.id === item.id && s.svcType === item.svcType)) return prev;
                                        return [...prev, newSvc];
                                      });
                                    }
                                  }}
                                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-2xs ${
                                    isChecked
                                      ? checkedBorderClass
                                      : "bg-white border-indigo-100 hover:border-indigo-300"
                                  }`}>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by click
                                        className="w-4 h-4 accent-indigo-650 cursor-pointer rounded-lg"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <CatIcon size={13} className="text-indigo-400 flex-shrink-0" />
                                        <p className="font-extrabold text-xs text-indigo-950 leading-normal line-clamp-1">{item.name}</p>
                                      </div>
                                      <p className="text-[10px] text-indigo-900/60 font-bold mt-1">
                                        {item.category_name || (item.svcType === "clinical" ? "خدمة سريرية" : "")} ·{" "}
                                        <strong className="text-amber-600 font-extrabold font-sans">0 ريال (معفي VIP)</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Toggle favorite tests
                                      setFavoriteTests((prev) => {
                                        const exists = prev.some((f) => f.test_id === item.id && f.test_type === item.svcType);
                                        if (exists) {
                                          axios.delete(`/api/doctor/favorites/${item.svcType}/${item.id}`, { headers });
                                          return prev.filter((f) => !(f.test_id === item.id && f.test_type === item.svcType));
                                        } else {
                                          axios.post("/api/doctor/favorites", { test_id: item.id, test_type: item.svcType }, { headers });
                                          return [...prev, { test_id: item.id, test_type: item.svcType }];
                                        }
                                      });
                                    }}
                                    className={`p-2 rounded-xl transition-all ${
                                      isStarred
                                        ? "text-amber-500 bg-amber-50"
                                        : "text-gray-300 hover:text-amber-500 hover:bg-gray-50 border border-transparent hover:border-gray-200"
                                    }`}>
                                    <Star
                                      size={14}
                                      fill={isStarred ? "currentColor" : "none"}
                                    />
                                  </button>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              {/* 4. Modal Checkout Footer (موافق) */}
              <div className="p-4 border-t border-gray-150 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-3.5 flex-shrink-0">
                <div className="text-right">
                  <span className="text-[10px] block font-black text-indigo-700">
                    إجمالي الفحوصات والخدمات المحددة للزيارة
                  </span>
                  <strong className="text-sm font-black text-indigo-950">
                    {selectedServices.length} خدمة طبية مقرر إضافتها
                  </strong>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-6 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer">
                    <CheckCircle size={15} />
                    موافق (حفظ وإغلاق)
                  </button>
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      

      {/* ── DOCUMENT PREVIEW MODAL ── */}
      {isPreviewModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            dir="rtl">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col border border-gray-100">
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                    <Eye size={18} className="text-indigo-600 animate-pulse" />{" "}
                    استعراض مستند النتيجة الطبية (VIP)
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
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gray-250 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer">
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        )}
      
    </div>
  );
}
