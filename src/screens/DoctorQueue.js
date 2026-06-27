import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Clock,
  History,
  Printer,
  Heart,
  AlertTriangle,
  Pill,
  FlaskConical,
  Radiation,
  Scissors,
  CheckCircle,
  X,
  Search,
  Plus,
  Trash2,
  Layers,
  Check,
  ChevronRight,
  Tag,
  Stethoscope,
  Grid,
  List,
  Star,
  Eye,
  Save,
  XCircle,
  FileText,
  Maximize,
  Minimize,
} from "lucide-react";
import { toast } from "react-toastify";
import Fuse from "fuse.js";
import axios from "axios";
import useAuthStore from "../store/useAuthStore";
import { getSocket } from "../utils/socket";
import taffyot from "../utils/taffyot";
import ComboboxSelect from "../components/ComboboxSelect";

// ── Status Config ──────────────────────────────────────────────────
const STATUS = {
  waiting: { label: "انتظار", color: "bg-amber-100 text-amber-700" },
  with_doctor: { label: "مع الطبيب", color: "bg-blue-100 text-blue-700" },
  post_surgery: {
    label: "ما بعد عملية",
    color: "bg-purple-100 text-purple-700",
  },
};

const VISIT_TYPE = {
  true: { label: "مراجعة", color: "bg-emerald-100 text-emerald-700" },
  false: { label: "جديد", color: "bg-gray-100 text-gray-600" },
};

// ── Sub-components ────────────────────────────────────────────────
const AlertBadge = ({ label, value, color }) => {
  if (!value) return null;
  return (
    <div className={`rounded-xl p-3 mb-3 border ${color}`}>
      <p className="text-xs font-bold mb-1">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────
export default function DoctorQueue() {
  const { token } = useAuthStore();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tabbed Workspace & layout states (Phase 2)
  const [workspaceTab, setWorkspaceTab] = useState("waiting_list"); // 'waiting_list' | 'pending_tracking' | 'completed_list'
  const [layoutMode, setLayoutMode] = useState("grid"); // 'grid' | 'list'
  const [searchTerm, setSearchTerm] = useState(""); // patient search filter

  // Catalogs
  const [catalogs, setCatalogs] = useState({
    lab: [],
    radiology: [],
    clinical: [],
    prep: [],
    medications: [],
  });

  // Selections for Orders
  const [selectedServices, setSelectedServices] = useState([]); // Array of objects
  const [serviceQuery, setServiceQuery] = useState("");

  // Prescriptions
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [rxMedQuery, setRxMedQuery] = useState("");

  // Tabs: 'queue' | 'timeline' | 'diagnostics' | 'orders' | 'prescription'
  const [activeTab, setActiveTab] = useState("queue");
  const [submitting, setSubmitting] = useState(false);

  // Patient history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Favorites & smart modal states
  const [favoriteTests, setFavoriteTests] = useState([]);
  const [favoriteMeds, setFavoriteMeds] = useState([]);
  const [preferredDosages, setPreferredDosages] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isOrderModalMaximized, setIsOrderModalMaximized] = useState(false);
  const [orderModalViewMode, setOrderModalViewMode] = useState("grid"); // 'grid' | 'list'
  const [activeOrderSubTab, setActiveOrderSubTab] = useState("order_new"); // 'order_new' | 'order_tracking'
  const [activeModalDept, setActiveModalDept] = useState("lab"); // 'lab' | 'radiology' | 'clinical' | 'favorites'
  const [activeModalCat, setActiveModalCat] = useState("");
  const [modalSearchTerm, setModalSearchTerm] = useState("");

  // Document preview modal states
  const [previewFile, setPreviewFile] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const openPreview = (file, name) => {
    setPreviewFile(file);
    setPreviewFileName(name);
    setIsPreviewModalOpen(true);
  };

  const headers = { Authorization: `Bearer ${token}` };

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get("/api/doctor/queue", { headers });
      setQueue(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("فشل تحميل قائمة الانتظار");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCatalogs = useCallback(async () => {
    try {
      const [lab, rad, clin, prep, meds] = await Promise.all([
        axios.get("/api/catalog/lab", { headers }),
        axios.get("/api/catalog/radiology", { headers }),
        axios.get("/api/admin/catalog/clinical-services", { headers }), // from phase 2
        axios.get("/api/admin/catalog/surgery-prep", { headers }), // from phase 2
        axios.get("/api/admin/catalog/medications", { headers }), // from phase 2
      ]);
      setCatalogs({
        lab: lab.data || [],
        radiology: rad.data || [],
        clinical: clin.data || [],
        prep: prep.data || [],
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
          final_price: basePrice,
          discount_percentage: 0,
          is_free: false,
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

  // Socket
  useEffect(() => {
    const socket = getSocket();
    socket.on("patient:waiting", () => fetchQueue());
    return () => socket.off("patient:waiting");
  }, [fetchQueue]);

  const handleSelectPatient = async (visit, isReadOnly = false) => {
    // Determine initial tab: if the patient has lab/rad completed results ready, direct to results tab!
    const badge = getPatientLiveBadge(visit);
    const initialTab = isReadOnly
      ? "timeline"
      : badge.label === "النتائج جاهزة"
        ? "diagnostics"
        : "orders";

    setActive({ ...visit, is_readonly: isReadOnly });
    setSelectedServices([]);
    setPrescriptionItems([]);
    setActiveTab(initialTab);
    setActiveOrderSubTab("order_new");

    const validStatusesToStart = ["waiting", "awaiting_lab", "awaiting_radiology", "pending_payment", "awaiting_service_payment"];
    if (!isReadOnly && validStatusesToStart.includes(visit.status)) {
      await axios.put(
        `/api/doctor/visit/${visit.visitId}/start`,
        {},
        { headers },
      );
      setQueue((q) =>
        q.map((v) =>
          v.visitId === visit.visitId ? { ...v, status: "with_doctor" } : v,
        ),
      );
    }
    // Load patient history
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

    // Load existing prescription if any for this visit
    try {
      const prescRes = await axios.get(
        `/api/doctor/visit/${visit.visitId}/prescription`,
        { headers },
      );
      if (
        prescRes.data &&
        prescRes.data.items &&
        prescRes.data.items.length > 0
      ) {
        setPrescriptionItems(prescRes.data.items);
      } else {
        setPrescriptionItems([]);
      }
    } catch (err) {
      setPrescriptionItems([]);
    }
  };

  const handleCloseVisit = async () => {
    setSubmitting(true);
    try {
      await axios.put(
        `/api/doctor/visit/${active.visitId}/close`,
        {},
        { headers },
      );
      toast.success("تم إغلاق الزيارة بنجاح");
      fetchQueue();
      setActive(null);
      setActiveTab("queue");
    } catch {
      toast.error("فشل إغلاق الزيارة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReferSurgery = async () => {
    setSubmitting(true);
    try {
      await axios.put(
        `/api/doctor/visit/${active.visitId}/refer-surgery`,
        {},
        { headers },
      );
      toast.success("تم إحالة المريض للعمليات");
      fetchQueue();
      setActive(null);
      setActiveTab("queue");
    } catch {
      toast.error("فشل الإحالة");
    } finally {
      setSubmitting(false);
    }
  };

  const refreshActivePatient = async (visitId) => {
    try {
      const res = await axios.get("/api/doctor/queue", { headers });
      const latestQueue = Array.isArray(res.data) ? res.data : [];
      setQueue(latestQueue);
      const latestActive = latestQueue.find((v) => v.visitId === visitId);
      if (latestActive) {
        setActive((prev) => ({
          ...latestActive,
          is_readonly: prev?.is_readonly || false,
        }));
      }
    } catch (err) {
      console.error("Failed to refresh active patient", err);
    }
  };

  const toggleFavoriteTest = async (item, svcType) => {
    const isFav = favoriteTests.some(
      (f) => f.test_id === item.id && f.test_type === svcType,
    );
    try {
      if (isFav) {
        await axios.delete(
          `/api/doctor/favorites/tests/type/${svcType}/id/${item.id}`,
          { headers },
        );
        toast.success("تم الإزالة من المفضلة");
      } else {
        await axios.post(
          "/api/doctor/favorites/tests",
          { testId: item.id, testType: svcType },
          { headers },
        );
        toast.success("تم الإضافة للمفضلة");
      }
      const res = await axios.get("/api/doctor/favorites/tests", { headers });
      setFavoriteTests(res.data || []);
    } catch (err) {
      toast.error("فشل تحديث المفضلة");
    }
  };

  const handleCancelRequest = async (type, id) => {
    if (!window.confirm("هل أنت متأكد من إلغاء هذا الطلب المالي؟")) return;
    try {
      const res = await axios.delete(
        `/api/doctor/order-service/${type}/${id}`,
        { headers },
      );
      toast.success(res.data?.message || "تم إلغاء الطلب بنجاح");
      refreshActivePatient(active.visitId);
    } catch (err) {
      toast.error(err.response?.data?.message || "فشل إلغاء الطلب");
    }
  };

  // ── Service Orders Logic ──
  const fuseServices = useMemo(() => {
    const all = [
      ...catalogs.lab.map((c) => ({ ...c, svcType: "lab" })),
      ...catalogs.radiology.map((c) => ({ ...c, svcType: "radiology" })),
      ...catalogs.clinical.map((c) => ({ ...c, svcType: "clinical" })),
    ];
    return new Fuse(all, { keys: ["name", "category_name"], threshold: 0.3 });
  }, [catalogs]);

  const searchResults = useMemo(() => {
    if (!serviceQuery) return [];
    return fuseServices
      .search(serviceQuery)
      .map((r) => r.item)
      .slice(0, 10);
  }, [serviceQuery, fuseServices]);

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
    if (isOrderModalOpen) {
      if (activeModalDept === 'favorites') {
        setActiveModalCat("");
      } else {
        const deptCats = categorizedCatalog[activeModalDept] || [];
        if (deptCats.length > 0) {
          if (!deptCats.some(c => c.name === activeModalCat)) {
            setActiveModalCat(deptCats[0].name);
          }
        } else {
          setActiveModalCat("");
        }
      }
    }
  }, [isOrderModalOpen, activeModalDept, categorizedCatalog, activeModalCat]);

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

  const addService = (svc) => {
    if (
      selectedServices.find((s) => s.id === svc.id && s.svcType === svc.svcType)
    )
      return;
    const basePrice =
      svc.svcType === "radiology" ? svc.price_with_film : svc.price;
    const newSvc = {
      ...svc,
      price: basePrice,
      withFilm: svc.svcType === "radiology" ? true : undefined,
      final_price: basePrice,
      discount_percentage: 0,
      is_free: false,
    };
    setSelectedServices((p) => [...p, newSvc]);
    setServiceQuery("");
  };

  const removeService = (idx) => {
    setSelectedServices((p) => p.filter((_, i) => i !== idx));
  };

  const updateService = (idx, field, val) => {
    setSelectedServices((p) =>
      p.map((s, i) => {
        if (i !== idx) return s;
        const updated = { ...s, [field]: val };

        // Calculate base price if radiology film changes
        if (field === "withFilm") {
          const basePrice = val ? s.price_with_film : s.price_without_film;
          updated.price = basePrice;
        }

        // Calculate final price and discount amount
        if (updated.is_free) {
          updated.discount_amount = updated.price;
          updated.final_price = 0;
        } else {
          const percent = parseFloat(updated.discount_percentage) || 0;
          updated.discount_amount = (updated.price * percent) / 100;
          updated.final_price = updated.price - updated.discount_amount;
        }

        return updated;
      }),
    );
  };

  const handleSubmitOrders = async () => {
    if (!selectedServices.length) return toast.warning("لم تقم بتحديد خدمات");
    setSubmitting(true);
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
      toast.success("تم إرسال الطلبات بنجاح");
      setSelectedServices([]);
      setIsOrderModalOpen(false);
      refreshActivePatient(active.visitId);
    } catch {
      toast.error("خطأ في الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Prescriptions Logic ──
  const addPrescriptionItem = () => {
    setPrescriptionItems((p) => [
      ...p,
      { medication_name: "", dosage: "", timing: "", duration: "", instructions: "" },
    ]);
  };

  const updateRxItem = (idx, field, val) => {
    setPrescriptionItems((p) =>
      p.map((item, i) => (i === idx ? { ...item, [field]: val } : item)),
    );
  };

  const handlePrintPrescription = () => {
    if (
      !prescriptionItems.length ||
      prescriptionItems.some((i) => !i.medication_name)
    ) {
      return toast.warning("يجب إضافة أدوية للروشتة أولاً");
    }
    // Simple popup print window
    const printWindow = window.open("", "_blank");
    const html = `
      <html dir="rtl">
        <head>
          <title>وصفة طبية</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 40px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #2563EB; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { max-height: 80px; }
            .patient-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-weight: bold; }
            .rx-title { font-size: 24px; color: #2563EB; font-style: italic; margin-bottom: 20px; font-weight: bold; }
            .item { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #ccc; }
            .med-name { font-size: 18px; font-weight: bold; }
            .instructions { color: #555; margin-top: 5px; }
            .footer { margin-top: 50px; text-align: left; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>ORTHOCARE CLINIC</h2>
            <p>لجراحة العظام والمفاصل والعمود الفقري</p>
          </div>
          <div class="patient-info">
            <span>اسم المريض: ${active?.full_name}</span>
            <span>التاريخ: ${new Date().toLocaleDateString("ar-LY")}</span>
          </div>
          <div class="rx-title">Rx</div>
          ${prescriptionItems
            .map(
              (item) => `
            <div class="item">
              <div class="med-name">${item.medication_name}</div>
              <div class="instructions">الجرعة: ${item.dosage} | المدة: ${item.duration}</div>
              ${item.instructions ? `<div class="instructions">التعليمات: ${item.instructions}</div>` : ""}
            </div>
          `,
            )
            .join("")}
          <div class="footer">توقيع الطبيب: _________________</div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSavePrescription = async (shouldPrint = false) => {
    if (
      !prescriptionItems.length ||
      prescriptionItems.some((i) => !i.medication_name)
    ) {
      return toast.warning("يجب إضافة أدوية للروشتة أولاً");
    }

    setSubmitting(true);
    try {
      // 2. Save Prescription to DB
      await axios.post(
        `/api/doctor/visit/${active.visitId}/prescription`,
        {
          items: prescriptionItems,
        },
        { headers },
      );

      toast.success("تم حفظ الوصفة الطبية في ملف المريض بنجاح");

      if (shouldPrint) {
        handlePrintPrescription();
      }
    } catch (err) {
      toast.error("فشل حفظ الوصفة الطبية");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Workspace Lists & Badge calculations (Phase 2) ──
  const activeWaitingList = useMemo(() => {
    return queue.filter(
      (v) =>
        (v.status === "waiting" ||
          v.status === "with_doctor" ||
          v.status === "post_surgery") &&
        !v.labRequests?.length &&
        !v.radiologyRequests?.length &&
        !v.clinicalRequests?.length,
    );
  }, [queue]);

  const pendingTrackingList = useMemo(() => {
    return queue.filter(
      (v) =>
        v.status !== "completed" &&
        v.status !== "cancelled" &&
        (v.labRequests?.length > 0 ||
          v.radiologyRequests?.length > 0 ||
          v.clinicalRequests?.length > 0),
    );
  }, [queue]);

  const completedList = useMemo(() => {
    return queue.filter((v) => v.status === "completed");
  }, [queue]);

  const filteredPatients = useMemo(() => {
    let currentList = [];
    if (workspaceTab === "waiting_list") currentList = activeWaitingList;
    else if (workspaceTab === "pending_tracking")
      currentList = pendingTrackingList;
    else if (workspaceTab === "completed_list") currentList = completedList;

    if (!searchTerm) return currentList;
    return currentList.filter(
      (v) =>
        v.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.visit_number?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [
    workspaceTab,
    searchTerm,
    activeWaitingList,
    pendingTrackingList,
    completedList,
  ]);

  const getPatientLiveBadge = (v) => {
    const allRequests = [
      ...(v.labRequests || []).map((r) => ({ ...r, type: "lab" })),
      ...(v.radiologyRequests || []).map((r) => ({ ...r, type: "radiology" })),
      ...(v.clinicalRequests || []).map((r) => ({ ...r, type: "clinical" })),
    ];

    if (allRequests.some((r) => r.status === "pending_payment")) {
      return {
        label: "بانتظار الدفع",
        color: "bg-rose-100 text-rose-700 border-rose-200",
      };
    }

    const activeExec = allRequests.filter(
      (r) => r.type === "lab" || r.type === "radiology",
    );
    if (
      activeExec.some((r) => r.status === "paid" || r.status === "in_progress")
    ) {
      return {
        label: "قيد التنفيذ",
        color: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse",
      };
    }

    const hasLabOrRad = activeExec.length > 0;
    const allLabRadCompleted = activeExec.every(
      (r) => r.status === "completed",
    );
    if (hasLabOrRad && allLabRadCompleted) {
      return {
        label: "النتائج جاهزة",
        color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    }

    return {
      label: "متابعة خدمات",
      color: "bg-blue-100 text-blue-750 border-blue-200",
    };
  };

  // ── Render ──
  if (!active) {
    return (
      <div className="space-y-6" dir="rtl">
        {/* Page Title & Counters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Stethoscope className="text-blue-600" /> مساحة العمل السريرية
              اليومية
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-semibold">
              إدارة قائمة الانتظار، طلبات الخدمات، وتتبع نتائج الفحوصات
              والزيارات الجارية لحظياً.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:flex-initial">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                placeholder="بحث باسم المريض أو ملفه..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-base pr-9 text-xs py-2 w-full md:w-56 font-bold"
              />
            </div>
            {/* Layout Toggle - Available for all tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setLayoutMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${layoutMode === "grid" ? "bg-white text-blue-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                <Grid size={16} />
              </button>
              <button
                onClick={() => setLayoutMode("list")}
                className={`p-1.5 rounded-lg transition-all ${layoutMode === "list" ? "bg-white text-blue-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 p-1 gap-2 bg-gray-50/50 rounded-2xl border border-gray-100 max-w-2xl">
          {[
            {
              id: "waiting_list",
              label: "قائمة الانتظار",
              count: activeWaitingList.length,
              color: "bg-blue-100 text-blue-700",
            },
            {
              id: "pending_tracking",
              label: "متابعة الإجراءات",
              count: pendingTrackingList.length,
              color: "bg-rose-100 text-rose-700",
            },
            {
              id: "completed_list",
              label: "تمت المعايتة",
              count: completedList.length,
              color: "bg-emerald-100 text-emerald-700",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setWorkspaceTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                workspaceTab === tab.id
                  ? "bg-white text-blue-700 shadow-sm border border-gray-100"
                  : "text-gray-500 hover:bg-white/50 hover:text-gray-700"
              }`}>
              {tab.label}
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tab.color}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dynamic Lists */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm">
            <Users className="mx-auto text-gray-300 mb-3" size={48} />
            <h3 className="text-base font-black text-gray-700">
              لا توجد نتائج تطابق بحثك
            </h3>
            <p className="text-gray-400 text-xs mt-1.5 font-semibold">
              تأكد من اختيار التبويب الصحيح أو تغيير معيار البحث.
            </p>
          </div>
        ) : (
          <div>
            {/* ACTIVE WAITING LIST VIEW */}
            {workspaceTab === "waiting_list" && (
              <div>
                {layoutMode === "grid" ? (
                  /* Grid mode */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPatients.map((visit) => {
                      const type = visit.is_follow_up
                        ? VISIT_TYPE["true"]
                        : visit.is_exempt
                          ? {
                              label: "حالة إعفاء VIP",
                              color:
                                "bg-purple-100 text-purple-700 border-purple-200",
                            }
                          : VISIT_TYPE["false"];
                      const timeStr = new Date(
                        visit.created_at,
                      ).toLocaleTimeString("ar-LY", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <motion.div
                          key={visit.visitId}
                          whileHover={{
                            y: -4,
                            shadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                          }}
                          onClick={() => handleSelectPatient(visit, false)}
                          className="bg-white p-5 rounded-3xl border border-gray-150 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-base">
                                  {visit.full_name?.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-gray-800 text-sm leading-normal">
                                    {visit.full_name}
                                  </h3>
                                  <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                    {visit.age} سنة ·{" "}
                                    {visit.gender === "male" ? "ذكر" : "أنثى"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold mb-3">
                              <Clock size={13} className="text-gray-400" />
                              وقت التسجيل:{" "}
                              <strong className="text-gray-600 font-black">
                                {timeStr}
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3.5 border-t border-gray-50 mt-1.5">
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${type.color}`}>
                              {type.label}
                            </span>
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                              <Stethoscope size={10} />
                              جاهز للمعاينة
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* List mode */
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-black text-gray-600">
                            المريض
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            الجنس / العمر
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            وقت التسجيل
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            نوع الزيارة
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600 w-24">
                            إجراء
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPatients.map((visit) => {
                          const type = visit.is_follow_up
                            ? VISIT_TYPE["true"]
                            : visit.is_exempt
                              ? {
                                  label: "حالة إعفاء VIP",
                                  color:
                                    "bg-purple-100 text-purple-700 border-purple-200",
                                }
                              : VISIT_TYPE["false"];
                          const timeStr = new Date(
                            visit.created_at,
                          ).toLocaleTimeString("ar-LY", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <tr
                              key={visit.visitId}
                              onClick={() => handleSelectPatient(visit, false)}
                              className="hover:bg-blue-50/20 cursor-pointer transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-800">
                                {visit.full_name}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {visit.gender === "male" ? "ذكر" : "أنثى"} ·{" "}
                                {visit.age} سنة
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {timeStr}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${type.color}`}>
                                  {type.label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button className="px-3.5 py-1.5 bg-blue-600 text-white font-extrabold text-xs rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                                  <Stethoscope size={12} /> معاينة
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* PENDING & RESULTS TRACKING VIEW */}
            {workspaceTab === "pending_tracking" && (
              <div>
                {layoutMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPatients.map((visit) => {
                      const badge = getPatientLiveBadge(visit);
                      const totalRequests =
                        (visit.labRequests?.length || 0) +
                        (visit.radiologyRequests?.length || 0) +
                        (visit.clinicalRequests?.length || 0);
                      const completedCount =
                        (visit.labRequests?.filter(
                          (r) => r.status === "completed",
                        ).length || 0) +
                        (visit.radiologyRequests?.filter(
                          (r) => r.status === "completed",
                        ).length || 0) +
                        (visit.clinicalRequests?.filter(
                          (r) => r.status === "completed",
                        ).length || 0);

                      return (
                        <motion.div
                          key={visit.visitId}
                          whileHover={{
                            y: -4,
                            shadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                          }}
                          onClick={() => handleSelectPatient(visit, false)}
                          className="bg-white p-5 rounded-3xl border border-gray-150 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-base">
                                  {visit.full_name?.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-gray-800 text-sm leading-normal">
                                    {visit.full_name}
                                  </h3>
                                  <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                    العمر: {visit.age} · ملف:{" "}
                                    {visit.visit_number}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Order breakdown */}
                            <div className="space-y-1.5 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 my-3 text-xs font-bold text-gray-500">
                              {visit.labRequests?.length > 0 && (
                                <p className="flex justify-between">
                                  <span>🧪 تحاليل مخبرية:</span>
                                  <strong className="text-gray-700">
                                    {visit.labRequests.length} فحص
                                  </strong>
                                </p>
                              )}
                              {visit.radiologyRequests?.length > 0 && (
                                <p className="flex justify-between">
                                  <span>☢️ أشعة تشخيصية:</span>
                                  <strong className="text-gray-700">
                                    {visit.radiologyRequests.length} فحص
                                  </strong>
                                </p>
                              )}
                              {visit.clinicalRequests?.length > 0 && (
                                <p className="flex justify-between">
                                  <span>🏨 خدمات سريرية:</span>
                                  <strong className="text-gray-700">
                                    {visit.clinicalRequests.length} خدمة
                                  </strong>
                                </p>
                              )}
                              <p className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 text-blue-700 text-[11px] font-black">
                                <span>نسبة الاكتمال:</span>
                                <span>
                                  {completedCount} من {totalRequests}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3.5 border-t border-gray-50">
                            <span
                              className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="text-[10px] font-black text-gray-400">
                              زيارة جارية
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-black text-gray-600">
                            المريض
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            الجنس / العمر
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            رقم الملف
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            تفصيل الإجراءات
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            نسبة الاكتمال
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            الحالة اللحظية
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600 w-24">
                            إجراء
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPatients.map((visit) => {
                          const badge = getPatientLiveBadge(visit);
                          const totalRequests =
                            (visit.labRequests?.length || 0) +
                            (visit.radiologyRequests?.length || 0) +
                            (visit.clinicalRequests?.length || 0);
                          const completedCount =
                            (visit.labRequests?.filter(
                              (r) => r.status === "completed",
                            ).length || 0) +
                            (visit.radiologyRequests?.filter(
                              (r) => r.status === "completed",
                            ).length || 0) +
                            (visit.clinicalRequests?.filter(
                              (r) => r.status === "completed",
                            ).length || 0);
                          const servicesList = [];
                          if (visit.labRequests?.length > 0)
                            servicesList.push(
                              `تحاليل (${visit.labRequests.length})`,
                            );
                          if (visit.radiologyRequests?.length > 0)
                            servicesList.push(
                              `أشعة (${visit.radiologyRequests.length})`,
                            );
                          if (visit.clinicalRequests?.length > 0)
                            servicesList.push(
                              `سريرية (${visit.clinicalRequests.length})`,
                            );

                          return (
                            <tr
                              key={visit.visitId}
                              onClick={() => handleSelectPatient(visit, false)}
                              className="hover:bg-rose-50/10 cursor-pointer transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-800">
                                {visit.full_name}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {visit.gender === "male" ? "ذكر" : "أنثى"} ·{" "}
                                {visit.age} سنة
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {visit.visit_number}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {servicesList.join(" · ") || "لا يوجد"}
                              </td>
                              <td className="px-6 py-4 text-xs font-black text-blue-700">
                                {completedCount} من {totalRequests}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button className="px-3.5 py-1.5 bg-rose-600 text-white font-extrabold text-xs rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1.5">
                                  <Stethoscope size={12} /> متابعة
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* COMPLETED CONSULTATIONS VIEW */}
            {workspaceTab === "completed_list" && (
              <div>
                {layoutMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPatients.map((visit) => {
                      const closeTimeStr = visit.closed_at
                        ? new Date(visit.closed_at).toLocaleTimeString(
                            "ar-LY",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : "مغلق";
                      return (
                        <motion.div
                          key={visit.visitId}
                          whileHover={{
                            y: -4,
                            shadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                          }}
                          onClick={() => handleSelectPatient(visit, true)}
                          className="bg-white p-5 rounded-3xl border border-gray-150 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-base">
                                  {visit.full_name?.charAt(0)}
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-gray-800 text-sm leading-normal">
                                    {visit.full_name}
                                  </h3>
                                  <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                    العمر: {visit.age} · ملف:{" "}
                                    {visit.visit_number}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold mb-3">
                              <Clock size={13} className="text-emerald-500" />
                              وقت الإغلاق:{" "}
                              <strong className="text-gray-600 font-black">
                                {closeTimeStr}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3.5 border-t border-gray-50 mt-1.5">
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-250 flex items-center gap-1">
                              مكتملة المعاينة
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPatient(visit, true);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors inline-flex items-center gap-1.5">
                              <Eye size={12} /> الاطلاع
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 font-black text-gray-600">
                            المريض
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            الجنس / العمر
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            رقم الملف
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600">
                            وقت الإغلاق
                          </th>
                          <th className="px-6 py-4 font-black text-gray-600 w-32 text-left pl-8">
                            التحكم
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPatients.map((visit) => {
                          const closeTimeStr = visit.closed_at
                            ? new Date(visit.closed_at).toLocaleTimeString(
                                "ar-LY",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "مغلق";
                          return (
                            <tr
                              key={visit.visitId}
                              className="hover:bg-emerald-50/10 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-800">
                                {visit.full_name}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                {visit.gender === "male" ? "ذكر" : "أنثى"} ·{" "}
                                {visit.age} سنة
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-blue-700">
                                {visit.visit_number}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-gray-500 flex items-center gap-1 mt-1.5">
                                <Clock size={12} className="text-emerald-500" />{" "}
                                {closeTimeStr}
                              </td>
                              <td className="px-6 py-4 text-left pl-8">
                                <button
                                  onClick={() =>
                                    handleSelectPatient(visit, true)
                                  }
                                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-xs rounded-xl border border-emerald-200 transition-colors inline-flex items-center gap-1.5">
                                  <Eye size={12} /> الاطلاع (قراءة فقط)
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]" dir="rtl">
      {/* Top Bar for Active Patient */}
      <div className="bg-white rounded-t-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActive(null)}
            className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
            <ChevronRight size={20} />
          </button>
          <div className="flex gap-3 items-center">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
              {active.full_name?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {active.full_name}
              </h2>
              <p className="text-sm text-gray-500 font-semibold">
                {active.age} سنة · {active.gender === "male" ? "ذكر" : "أنثى"} ·
                ملف: {active.visit_number}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!active.is_readonly ? (
            <>
              <button
                onClick={handleReferSurgery}
                disabled={submitting}
                className="btn-primary bg-purple-600 hover:bg-purple-700 border-none flex items-center gap-2">
                <Scissors size={16} /> إحالة للعمليات
              </button>
              <button
                onClick={handleCloseVisit}
                disabled={submitting}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 border-none flex items-center gap-2">
                <CheckCircle size={16} /> إنهاء الزيارة
              </button>
            </>
          ) : (
            <span className="px-4 py-2 bg-rose-100 text-rose-700 font-black rounded-xl border border-rose-200 text-xs">
              سجل مؤرشف (للقراءة فقط)
            </span>
          )}
        </div>
      </div>

      {active.is_readonly && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-2xl flex items-center gap-3 mb-4 font-bold text-sm">
          <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
          <span>
            تنبيه أمني: هذا السجل الطبي مؤرشف للقراءة فقط. يمنع تعديل البيانات،
            كتابة وصفات جديدة أو طلب خدمات إضافية.
          </span>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-2 gap-2">
            {[
              { id: "orders", label: "الطلبات والخدمات", icon: Layers },
              { id: "prescription", label: "الوصفة الطبية (Rx)", icon: Pill },
              {
                id: "diagnostics",
                label: "النتائج والتقارير",
                icon: FlaskConical,
              },
              { id: "timeline", label: "التاريخ الطبي", icon: History },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === t.id
                    ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}>
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* ── ORDERS TAB ── */}
            {activeTab === "orders" && (
              <div className="space-y-6">
                {/* Sub tabs for Orders */}
                <div className="flex gap-2 border-b border-gray-100 pb-2">
                  <button
                    onClick={() => setActiveOrderSubTab("order_new")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeOrderSubTab === "order_new" ? "bg-blue-50 text-blue-700 font-extrabold" : "text-gray-500 hover:bg-gray-50"}`}>
                    طلب خدمة جديدة
                  </button>
                  <button
                    onClick={() => setActiveOrderSubTab("order_tracking")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeOrderSubTab === "order_tracking" ? "bg-blue-50 text-blue-700 font-extrabold" : "text-gray-500 hover:bg-gray-50"}`}>
                    متابعة وحالة الطلبات
                  </button>
                </div>

                {activeOrderSubTab === "order_new" && (
                  <div className="space-y-4">
                    {active.is_readonly ? (
                      <div className="p-8 text-center bg-gray-50 rounded-2xl text-gray-500 font-bold border border-dashed">
                        وضع القراءة فقط مفعل. انتقل لتبويب المتابعة لمشاهدة
                        الفحوصات الجارية.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center space-y-4 hover:border-blue-400 transition-all bg-gray-50/50">
                          <Layers
                            size={48}
                            className="mx-auto text-blue-600 animate-bounce"
                          />
                          <div>
                            <h3 className="font-extrabold text-lg text-gray-800">
                              إضافة طلبات خدمات وفحوصات
                            </h3>
                            <p className="text-xs text-gray-400 mt-1 font-semibold">
                              مختبر، أشعة تشخيصية، خدمات سريرية، أو تجهيز عمليات
                            </p>
                          </div>
                          <button
                            onClick={() => setIsOrderModalOpen(true)}
                            className="btn-primary bg-blue-600 hover:bg-blue-700 border-none px-6 py-3 font-bold text-sm shadow-md">
                            (+ إضافة إجراء جديد)
                          </button>
                        </div>

                        {selectedServices.length > 0 && (
                          <div className="space-y-4">
                            <h3 className="font-extrabold text-gray-800 border-b border-gray-100 pb-2 flex justify-between items-center text-sm">
                              <span>سلة الطلبات المؤقتة (موزعة حسب الأقسام)</span>
                              <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-black">
                                {selectedServices.length} خدمة
                              </span>
                            </h3>

                            {/* 1. Lab Services */}
                            {selectedServices.filter(s => s.svcType === 'lab').length > 0 && (
                              <div className="bg-blue-50/20 p-4 rounded-2xl border border-blue-100/50 space-y-3">
                                <h4 className="font-black text-blue-800 text-xs flex items-center gap-1.5 pb-2 border-b border-blue-100/50">
                                  🧪 التحاليل المخبرية المطلوبة ({selectedServices.filter(s => s.svcType === 'lab').length})
                                </h4>
                                <div className="space-y-2.5">
                                  {selectedServices.map((svc, idx) => {
                                    if (svc.svcType !== 'lab') return null;
                                    return (
                                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-4 shadow-2xs text-xs">
                                        <div>
                                          <p className="font-bold text-gray-800">{svc.name}</p>
                                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">السعر الأساسي: {svc.price} ريال</p>
                                        </div>
                                        <div className="flex items-center gap-3.5 flex-wrap">
                                          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                                            <span className="px-2 py-1 text-gray-400 bg-gray-100 border-l border-gray-200">% الخصم</span>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={svc.discount_percentage}
                                              onChange={(e) => updateService(idx, "discount_percentage", e.target.value)}
                                              disabled={svc.is_free}
                                              className="w-12 text-center font-bold outline-none disabled:bg-gray-100"
                                            />
                                          </div>
                                          <label className="flex items-center gap-1.5 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">
                                            <input
                                              type="checkbox"
                                              checked={svc.is_free}
                                              onChange={(e) => updateService(idx, "is_free", e.target.checked)}
                                              className="accent-emerald-600 w-3.5 h-3.5"
                                            />
                                            <span>مجاني</span>
                                          </label>
                                          <button onClick={() => removeService(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={15} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 2. Radiology Services */}
                            {selectedServices.filter(s => s.svcType === 'radiology').length > 0 && (
                              <div className="bg-rose-50/20 p-4 rounded-2xl border border-rose-100/50 space-y-3">
                                <h4 className="font-black text-rose-800 text-xs flex items-center gap-1.5 pb-2 border-b border-rose-100/50">
                                  ☢️ الفحوصات الإشعاعية المطلوبة ({selectedServices.filter(s => s.svcType === 'radiology').length})
                                </h4>
                                <div className="space-y-2.5">
                                  {selectedServices.map((svc, idx) => {
                                    if (svc.svcType !== 'radiology') return null;
                                    return (
                                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-4 shadow-2xs text-xs">
                                        <div>
                                          <p className="font-bold text-gray-800">{svc.name}</p>
                                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">السعر الأساسي: {svc.price} ريال</p>
                                        </div>
                                        <div className="flex items-center gap-3.5 flex-wrap">
                                          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                                            <span className="px-2 py-1 text-gray-400 bg-gray-100 border-l border-gray-200">% الخصم</span>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={svc.discount_percentage}
                                              onChange={(e) => updateService(idx, "discount_percentage", e.target.value)}
                                              disabled={svc.is_free}
                                              className="w-12 text-center font-bold outline-none disabled:bg-gray-100"
                                            />
                                          </div>
                                          <label className="flex items-center gap-1.5 cursor-pointer bg-rose-50 text-rose-700 border border-rose-100 px-2 py-1 rounded-lg text-[10px] font-black">
                                            <input
                                              type="checkbox"
                                              checked={svc.withFilm}
                                              onChange={(e) => updateService(idx, "withFilm", e.target.checked)}
                                              className="accent-rose-600 w-3.5 h-3.5"
                                            />
                                            <span>مع فيلم (بدون: {svc.price_without_film || 0})</span>
                                          </label>
                                          <label className="flex items-center gap-1.5 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">
                                            <input
                                              type="checkbox"
                                              checked={svc.is_free}
                                              onChange={(e) => updateService(idx, "is_free", e.target.checked)}
                                              className="accent-emerald-600 w-3.5 h-3.5"
                                            />
                                            <span>مجاني</span>
                                          </label>
                                          <button onClick={() => removeService(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={15} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 3. Clinical Services */}
                            {selectedServices.filter(s => s.svcType === 'clinical').length > 0 && (
                              <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/50 space-y-3">
                                <h4 className="font-black text-emerald-800 text-xs flex items-center gap-1.5 pb-2 border-b border-emerald-100/50">
                                  🩺 الخدمات الطبية والسريرية المطلوبة ({selectedServices.filter(s => s.svcType === 'clinical').length})
                                </h4>
                                <div className="space-y-2.5">
                                  {selectedServices.map((svc, idx) => {
                                    if (svc.svcType !== 'clinical') return null;
                                    return (
                                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between gap-4 shadow-2xs text-xs">
                                        <div>
                                          <p className="font-bold text-gray-800">{svc.name}</p>
                                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">السعر الأساسي: {svc.price} ريال</p>
                                        </div>
                                        <div className="flex items-center gap-3.5 flex-wrap">
                                          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden text-[10px]">
                                            <span className="px-2 py-1 text-gray-400 bg-gray-150 border-l border-gray-200">% الخصم</span>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={svc.discount_percentage}
                                              onChange={(e) => updateService(idx, "discount_percentage", e.target.value)}
                                              disabled={svc.is_free}
                                              className="w-12 text-center font-bold outline-none disabled:bg-gray-100"
                                            />
                                          </div>
                                          <label className="flex items-center gap-1.5 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">
                                            <input
                                              type="checkbox"
                                              checked={svc.is_free}
                                              onChange={(e) => updateService(idx, "is_free", e.target.checked)}
                                              className="accent-emerald-600 w-3.5 h-3.5"
                                            />
                                            <span>مجاني</span>
                                          </label>
                                          <button onClick={() => removeService(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={15} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="pt-4 flex justify-end">
                              <button
                                onClick={handleSubmitOrders}
                                disabled={submitting}
                                className="btn-primary w-48 flex justify-center bg-blue-600 hover:bg-blue-700 border-none shadow-md">
                                إرسال الطلبات
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeOrderSubTab === "order_tracking" && (
                  <div className="space-y-4">
                    <h3 className="font-extrabold text-sm text-gray-800">
                      حالة الفحوصات والخدمات للزيارة الحالية
                    </h3>
                    {(() => {
                      const list = [
                        ...(active.labRequests || []).map((r) => ({
                          ...r,
                          svcType: "lab",
                          icon: FlaskConical,
                          iconColor: "bg-blue-100 text-blue-600",
                        })),
                        ...(active.radiologyRequests || []).map((r) => ({
                          ...r,
                          svcType: "radiology",
                          icon: Radiation,
                          iconColor: "bg-rose-100 text-rose-600",
                        })),
                        ...(active.clinicalRequests || []).map((r) => ({
                          ...r,
                          svcType: "clinical",
                          icon: Layers,
                          iconColor: "bg-emerald-100 text-emerald-600",
                        })),
                      ];

                      if (list.length === 0) {
                        return (
                          <div className="text-center p-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <Layers
                              className="mx-auto text-gray-300 mb-2"
                              size={32}
                            />
                            <p className="text-sm text-gray-500 font-bold">
                              لا يوجد خدمات مطلوبة في هذه الزيارة بعد.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-gray-50 border-b border-gray-100">
                              <tr>
                                <th className="px-4 py-3 font-black text-gray-600">
                                  النوع
                                </th>
                                <th className="px-4 py-3 font-black text-gray-600">
                                  اسم الخدمة
                                </th>
                                <th className="px-4 py-3 font-black text-gray-600">
                                  السعر النهائي
                                </th>
                                <th className="px-4 py-3 font-black text-gray-600">
                                  الحالة
                                </th>
                                <th className="px-4 py-3 font-black text-gray-600 w-24">
                                  التحكم
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {list.map((item, idx) => {
                                let statusLabel = "غير معروف";
                                let statusColor = "bg-gray-100 text-gray-600";
                                if (item.status === "pending_payment") {
                                  statusLabel = "🔴 بانتظار الدفع";
                                  statusColor =
                                    "bg-rose-50 text-rose-700 border-rose-100";
                                } else if (item.status === "paid") {
                                  statusLabel = "🟡 مدفوع/بانتظار التنفيذ";
                                  statusColor =
                                    "bg-amber-50 text-amber-700 border-amber-100";
                                } else if (item.status === "in_progress") {
                                  statusLabel = "⚡ قيد التنفيذ";
                                  statusColor =
                                    "bg-blue-50 text-blue-700 border-blue-100 animate-pulse";
                                } else if (item.status === "completed") {
                                  statusLabel = "🟢 مكتمل النتائج";
                                  statusColor =
                                    "bg-emerald-50 text-emerald-700 border-emerald-100";
                                } else if (item.status === "cancelled") {
                                  statusLabel = "⚪ ملغي";
                                  statusColor =
                                    "bg-gray-100 text-gray-500 border-gray-200";
                                } else if (item.status === "refunded") {
                                  statusLabel = "💸 مسترد مالياً";
                                  statusColor =
                                    "bg-purple-50 text-purple-700 border-purple-100";
                                }

                                const writtenPrice = taffyot(item.final_price);

                                return (
                                  <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                          item.svcType === "lab"
                                            ? "bg-blue-50 text-blue-700"
                                            : item.svcType === "radiology"
                                              ? "bg-rose-50 text-rose-700"
                                              : "bg-emerald-50 text-emerald-700"
                                        }`}>
                                        <item.icon size={10} />
                                        {item.svcType === "lab"
                                          ? "مختبر"
                                          : item.svcType === "radiology"
                                            ? "أشعة"
                                            : "سريري"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 font-extrabold text-gray-800">
                                      {item.name}{" "}
                                      {item.with_film === 1 && "(مع فيلم)"}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-gray-700">
                                      {item.final_price} ريال
                                      {parseFloat(item.final_price) > 0 && (
                                        <p className="text-[9px] font-bold text-gray-400 mt-0.5">
                                          ({writtenPrice})
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-1 rounded-lg border text-[10px] font-black ${statusColor}`}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {item.status === "pending_payment" &&
                                      !active.is_readonly ? (
                                        <button
                                          onClick={() =>
                                            handleCancelRequest(
                                              item.svcType,
                                              item.id,
                                            )
                                          }
                                          className="text-red-600 hover:text-red-800 font-extrabold text-[10px] bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                                          <XCircle size={10} /> إلغاء الطلب
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 font-semibold">
                                          غير متاح
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ── PRESCRIPTION TAB ── */}
            {activeTab === "prescription" && (
              <div className="max-w-4xl space-y-5 animate-fadeIn">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-blue-50 to-white p-5 rounded-2xl border border-blue-100 shadow-sm gap-4">
                  <div>
                    <h3 className="font-black text-blue-900 text-lg flex items-center gap-2">
                      <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                        <Pill size={22} />
                      </div>
                      الوصفة الطبية الإلكترونية (e-Rx)
                    </h3>
                    <p className="text-[11px] text-gray-500 font-bold mt-1.5 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-500" />
                      يرجى التأكد من الجرعات والمدة قبل حفظ الوصفة في السجل الطبي
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {!active.is_readonly && (
                      <button
                        onClick={() => handleSavePrescription(false)}
                        className="flex-1 md:flex-none py-2.5 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-95">
                        <Save size={16} /> اعتماد
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {prescriptionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="group relative bg-white border border-gray-150 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                      
                      <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shadow-sm">
                        {idx + 1}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-5 mt-2">
                        {/* Drug Name */}
                        <div className="col-span-1 md:col-span-12 relative pr-8 md:pr-10">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1.5 block">
                            1. اسم الدواء (Medication)
                          </label>
                          <ComboboxSelect
                            value={item.medication_name}
                            onChange={(val) => updateRxItem(idx, "medication_name", val)}
                            options={catalogs.medications.map((m) => m.name)}
                            disabled={active.is_readonly}
                            placeholder="ابحث أو اختر اسم الدواء..."
                            theme="blue"
                            emptyMessage="الدواء غير مدرج، سيتم اعتماده كإدخال يدوي"
                          />
                        </div>

                        {/* Dosage */}
                        <div className="col-span-1 md:col-span-4 relative">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 block">
                            2. الجرعة (Dosage)
                          </label>
                          <ComboboxSelect
                            value={item.dosage}
                            onChange={(val) => updateRxItem(idx, "dosage", val)}
                            options={["مرة يومياً", "مرتين يومياً", "ثلاث مرات يومياً", "مرة كل 6 ساعات", "مرة كل 12 ساعة", ...preferredDosages.map(p => p.dosage)]}
                            disabled={active.is_readonly}
                            placeholder="مثال: مرتين يومياً..."
                            theme="blue"
                            emptyMessage="اكتب الجرعة الخاصة بك"
                          />
                        </div>

                        {/* Timing */}
                        <div className="col-span-1 md:col-span-4 relative">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 block">
                            3. التوقيت (Timing)
                          </label>
                          <ComboboxSelect
                            value={item.timing || ""}
                            onChange={(val) => updateRxItem(idx, "timing", val)}
                            options={["بعد الأكل", "قبل الأكل", "أثناء الأكل", "على الريق", "قبل النوم"]}
                            disabled={active.is_readonly}
                            placeholder="مثال: بعد الأكل..."
                            theme="blue"
                            emptyMessage="اكتب التوقيت المخصص"
                          />
                        </div>

                        {/* Duration */}
                        <div className="col-span-1 md:col-span-4 relative">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 block">
                            4. المدة (Duration)
                          </label>
                          <ComboboxSelect
                            value={item.duration}
                            onChange={(val) => updateRxItem(idx, "duration", val)}
                            options={["ثلاثة أيام", "أسبوع", "أسبوعين", "ثلاثة أسابيع", "شهر", "شهرين", "عند اللزوم"]}
                            disabled={active.is_readonly}
                            placeholder="مثال: لمدة أسبوع..."
                            theme="blue"
                            emptyMessage="اكتب المدة المخصصة"
                          />
                        </div>

                        {/* Instructions */}
                        <div className="col-span-1 md:col-span-12 relative mt-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5 block">
                            5. التعليمات والملاحظات للمريض (Instructions)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={item.instructions}
                              onChange={(e) => updateRxItem(idx, "instructions", e.target.value)}
                              className="flex-1 bg-gray-50/80 border border-gray-200 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all outline-none"
                              placeholder="أدخل أي ملاحظات إضافية (اختياري)..."
                              disabled={active.is_readonly}
                              dir="rtl"
                            />
                            {!active.is_readonly && (
                              <button
                                onClick={() => setPrescriptionItems((p) => p.filter((_, i) => i !== idx))}
                                className="px-4 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl border border-red-100 transition-all cursor-pointer flex items-center justify-center shadow-sm transform hover:scale-[1.05] active:scale-95">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!active.is_readonly && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={addPrescriptionItem}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 font-bold hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group cursor-pointer">
                        <div className="bg-white p-1 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                          <Plus size={16} className="text-blue-500" />
                        </div>
                        إضافة دواء جديد يدوي
                      </button>
                      
                      <div className="relative group w-full">
                        <button className="w-full h-full py-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-500 font-bold hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <div className="bg-white p-1 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                            <Star size={16} className="text-yellow-500" />
                          </div>
                          إدراج من المفضلة
                        </button>
                        <div className="absolute bottom-[110%] left-0 w-full bg-white border border-gray-150 rounded-2xl shadow-xl p-2 hidden group-hover:block z-50 max-h-60 overflow-y-auto" dir="rtl">
                          {preferredDosages.length === 0 ? (
                             <div className="p-4 text-center text-xs text-gray-400">لا توجد مفضلة مسجلة حالياً</div>
                          ) : (
                            preferredDosages.map((pd, i) => (
                              <div 
                                key={i} 
                                onClick={() => {
                                  setPrescriptionItems(p => [...p, {
                                    medication_name: pd.medicationName || pd.medication_name || "",
                                    dosage: pd.dosage || "",
                                    timing: pd.timing || "",
                                    duration: pd.duration || "",
                                    instructions: pd.instructions || ""
                                  }]);
                                }}
                                className="p-3 hover:bg-yellow-50 rounded-xl cursor-pointer flex flex-col gap-1 border-b border-gray-50 last:border-none transition-colors"
                              >
                                 <span className="text-xs font-bold text-gray-800">{pd.medicationName || "جرعة مفضلة فقط"}</span>
                                 <span className="text-[10px] text-gray-500 flex gap-1 items-center flex-wrap">
                                   {pd.dosage && <span className="bg-yellow-100 px-2 py-0.5 rounded-md text-yellow-700">{pd.dosage}</span>}
                                   {(pd.timing || pd.duration) && (
                                     <span className="bg-gray-100 px-2 py-0.5 rounded-md">{pd.timing} {pd.duration}</span>
                                   )}
                                 </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── DIAGNOSTICS/RESULTS TAB ── */}
            {activeTab === "diagnostics" && (
              <div className="space-y-6">
                <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2 border-b border-gray-150 pb-2">
                  <FlaskConical className="text-blue-600" size={18} /> نتائج
                  وتقارير الفحوصات والزيارة
                </h3>

                {(() => {
                  const completedLabs = (active.labRequests || []).filter(
                    (r) => r.status === "completed",
                  );
                  const completedRads = (active.radiologyRequests || []).filter(
                    (r) => r.status === "completed",
                  );
                  const hasResults =
                    completedLabs.length > 0 || completedRads.length > 0;

                  if (!hasResults) {
                    return (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-3xl border border-dashed">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-3xl">
                          🧪
                        </div>
                        <p className="font-bold text-gray-600 text-lg">
                          النتائج ستظهر هنا فور إتمامها
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          لا يوجد أي فحوصات مخبرية أو إشعاعية مكتملة لهذه
                          الزيارة حالياً.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {completedLabs.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-black text-blue-700 text-xs flex items-center gap-1.5">
                            🧪 نتائج التحاليل المخبرية
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {completedLabs.map((item, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm space-y-3">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <span className="font-extrabold text-sm text-gray-800">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                                    مكتمل
                                  </span>
                                </div>
                                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                  <p className="text-[11px] font-bold text-gray-500 mb-1">
                                    ملاحظات ونتائج المختبر:
                                  </p>
                                  <p className="text-xs font-semibold text-gray-800 whitespace-pre-wrap">
                                    {item.result_notes ||
                                      "لم يسجل الفني أي ملاحظات"}
                                  </p>
                                </div>
                                {item.result_file && (
                                  <div className="flex justify-end pt-1">
                                    <button
                                      onClick={() =>
                                        openPreview(
                                          item.result_file,
                                          `تقرير مختبر - ${item.name}`,
                                        )
                                      }
                                      className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-[10px] inline-flex items-center gap-1.5 transition-colors cursor-pointer">
                                      <Eye size={12} /> عرض تقرير المختبر
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {completedRads.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <h4 className="font-black text-rose-700 text-xs flex items-center gap-1.5">
                            ☢️ نتائج الفحوصات الإشعاعية
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {completedRads.map((item, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm space-y-3">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                  <div>
                                    <span className="font-extrabold text-sm text-gray-800">
                                      {item.name}
                                    </span>
                                    {item.with_film === 1 && (
                                      <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded ml-1">
                                        مع فيلم
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                                    مكتمل
                                  </span>
                                </div>
                                <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                  <p className="text-[11px] font-bold text-gray-500 mb-1">
                                    ملاحظات وتقرير الأخصائي:
                                  </p>
                                  <p className="text-xs font-semibold text-gray-800 whitespace-pre-wrap">
                                    {item.result_notes ||
                                      "لم يسجل الطبيب الفني أي تقرير"}
                                  </p>
                                </div>
                                {item.result_file && (
                                  <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
                                    {(() => {
                                      try {
                                        const files = JSON.parse(
                                          item.result_file,
                                        );
                                        if (Array.isArray(files)) {
                                          return files.map((file, fi) => (
                                            <button
                                              key={fi}
                                              onClick={() =>
                                                openPreview(
                                                  file.base64 || file,
                                                  `${item.name} - ملف #${fi + 1}`,
                                                )
                                              }
                                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 rounded-lg text-[9px] font-bold transition-all cursor-pointer inline-flex items-center gap-1">
                                              <Eye size={10} /> عرض ملف أشعة #
                                              {fi + 1}
                                            </button>
                                          ));
                                        }
                                      } catch {
                                        return (
                                          <button
                                            onClick={() =>
                                              openPreview(
                                                item.result_file,
                                                `تقرير أشعة - ${item.name}`,
                                              )
                                            }
                                            className="px-3.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold text-[10px] inline-flex items-center gap-1.5 transition-colors cursor-pointer">
                                            <Eye size={12} /> عرض تقرير الأشعة
                                          </button>
                                        );
                                      }
                                    })()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <History size={20} className="text-blue-600" /> السجل الطبي
                  للمريض
                </h3>
                {historyLoading ? (
                  <div className="flex justify-center p-8">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center p-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <History size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="font-bold text-gray-600">
                      لا توجد زيارات سابقة
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((visit, i) => (
                      <div
                        key={visit.id}
                        className="bg-white border border-gray-150 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">
                                {visit.visit_number}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(visit.created_at).toLocaleDateString(
                                  "ar-LY",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                              visit.status === "completed"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : "bg-blue-100 text-blue-700 border border-blue-200"
                            }`}>
                            {visit.status === "completed" ? "مكتملة" : "جارية"}
                          </span>
                        </div>
                        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 text-xs">
                          {/* 1. Lab Section */}
                          {visit.labTests?.length > 0 && (
                            <div className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100/50 space-y-2">
                              <h5 className="font-extrabold text-blue-800 flex items-center gap-1.5 text-xs">
                                🧪 الفحوصات المخبرية ({visit.labTests.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {visit.labTests.map((t, ti) => (
                                  <div
                                    key={ti}
                                    className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2 shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <span className="font-bold text-gray-800">
                                        {t.name}
                                      </span>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                                          t.status === "completed"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                        }`}>
                                        {t.status === "completed"
                                          ? "مكتمل"
                                          : "معلق"}
                                      </span>
                                    </div>
                                    {t.result_notes && (
                                      <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg leading-normal font-semibold">
                                        📝 النتيجة: {t.result_notes}
                                      </p>
                                    )}
                                    {t.result_file && (
                                      <button
                                        onClick={() =>
                                          openPreview(
                                            t.result_file,
                                            `تقرير مختبر - ${t.name} (زيارة ${visit.visit_number})`,
                                          )
                                        }
                                        className="self-end px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black border border-blue-100/50 flex items-center gap-1 cursor-pointer transition-all">
                                        <Eye size={10} /> عرض التقرير
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 2. Radiology Section */}
                          {visit.radiologyTests?.length > 0 && (
                            <div className="bg-rose-50/30 rounded-2xl p-4 border border-rose-100/50 space-y-2">
                              <h5 className="font-extrabold text-rose-800 flex items-center gap-1.5 text-xs">
                                ☢️ الفحوصات الإشعاعية (
                                {visit.radiologyTests.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {visit.radiologyTests.map((t, ti) => (
                                  <div
                                    key={ti}
                                    className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col justify-between gap-2 shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <span className="font-bold text-gray-800">
                                        {t.name}
                                      </span>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                                          t.status === "completed"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                        }`}>
                                        {t.status === "completed"
                                          ? "مكتمل"
                                          : "معلق"}
                                      </span>
                                    </div>
                                    {t.result_notes && (
                                      <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg leading-normal font-semibold">
                                        📝 التقرير: {t.result_notes}
                                      </p>
                                    )}
                                    {t.result_file && (
                                      <div className="flex flex-wrap gap-1.5 justify-end">
                                        {(() => {
                                          try {
                                            const files = JSON.parse(
                                              t.result_file,
                                            );
                                            if (Array.isArray(files)) {
                                              return files.map((file, fi) => (
                                                <button
                                                  key={fi}
                                                  onClick={() =>
                                                    openPreview(
                                                      file.base64 || file,
                                                      `${t.name} - ملف #${fi + 1} (زيارة ${visit.visit_number})`,
                                                    )
                                                  }
                                                  className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 rounded-lg text-[9px] font-black transition-all cursor-pointer inline-flex items-center gap-1">
                                                  <Eye size={9} /> ملف #{fi + 1}
                                                </button>
                                              ));
                                            }
                                          } catch {
                                            return (
                                              <button
                                                onClick={() =>
                                                  openPreview(
                                                    t.result_file,
                                                    `تقرير أشعة - ${t.name} (زيارة ${visit.visit_number})`,
                                                  )
                                                }
                                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[9px] font-black border border-rose-100/50 flex items-center gap-1 cursor-pointer transition-all">
                                                <Eye size={10} /> عرض التقرير
                                              </button>
                                            );
                                          }
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 3. Clinical Services Section */}
                          {visit.clinicalServices?.length > 0 && (
                            <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100/50 space-y-2">
                              <h5 className="font-extrabold text-emerald-800 flex items-center gap-1.5 text-xs">
                                🩺 الخدمات الطبية والسريرية (
                                {visit.clinicalServices.length})
                              </h5>
                              <div className="mt-2 bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                                <span className="font-semibold text-gray-500">
                                  الخدمات السريرية المقررة:{" "}
                                </span>
                                <span className="font-bold text-gray-800 font-sans">
                                  {visit.clinicalServices
                                    .map((c) => c.name)
                                    .join(" ، ")}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 4. Prescribed Medications Section */}
                          {visit.prescriptionItems?.length > 0 && (
                            <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100/50 space-y-2">
                              <h5 className="font-extrabold text-amber-800 flex items-center gap-1.5 text-xs">
                                💊 الروشتة والأدوية المقررة (
                                {visit.prescriptionItems.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {visit.prescriptionItems.map((med, medi) => (
                                  <div
                                    key={medi}
                                    className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs flex gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                                      <Pill size={16} />
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-gray-800 text-xs">
                                        {med.medication_name}
                                      </p>
                                      <p className="text-[10px] text-gray-500 font-semibold">
                                        الجرعة:{" "}
                                        <span className="text-gray-700 font-bold">
                                          {med.dosage}
                                        </span>{" "}
                                        · المدة:{" "}
                                        <span className="text-gray-700 font-bold">
                                          {med.duration}
                                        </span>
                                      </p>
                                      {med.instructions && (
                                        <p className="text-[9px] text-amber-800 font-semibold bg-amber-50/50 px-2 py-0.5 rounded mt-1">
                                          التعليمات: {med.instructions}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 5. Surgeries Section */}
                          {visit.surgeries?.length > 0 && (
                            <div className="bg-purple-50/30 rounded-2xl p-4 border border-purple-100/50 space-y-2">
                              <h5 className="font-extrabold text-purple-800 flex items-center gap-1.5 text-xs">
                                ✂️ العمليات الجراحية وحجز العمليات ({visit.surgeries.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                {visit.surgeries.map((s, si) => (
                                  <div key={si} className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs flex justify-between items-center">
                                    <div>
                                      <p className="font-bold text-gray-800">{s.surgery_type || 'غير محدد'}</p>
                                      {s.scheduled_date && (
                                        <p className="text-[9px] text-gray-500 font-semibold mt-0.5">
                                          تاريخ الجدولة: {new Date(s.scheduled_date).toLocaleDateString('ar')}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold">
                                      {s.status === 'completed' ? 'تمت' : s.status === 'cancelled' ? 'ملغية' : 'مجدولة'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isOrderModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              className={`bg-white shadow-2xl flex flex-col border border-gray-150 animate-fadeIn transition-all duration-300 ${
                isOrderModalMaximized
                  ? "w-screen h-screen rounded-none"
                  : "w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden"
              }`}>
              
              {/* 1. Modal Header */}
              <div className="flex justify-between items-center p-3.5 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/20">
                <div>
                  <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                    <Stethoscope size={22} className="text-blue-600 animate-pulse" />
                    <span>كتالوج طلب الخدمات والفحوصات (Smart Order)</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 font-bold">
                    نافذة اختيار الفحوصات المتكاملة والمباشرة للمريض
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 ml-3">
                    <button
                      onClick={() => setOrderModalViewMode("grid")}
                      className={`p-1.5 rounded-lg transition-all ${
                        orderModalViewMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-blue-500"
                      }`}
                      title="عرض شبكي">
                      <Grid size={16} />
                    </button>
                    <button
                      onClick={() => setOrderModalViewMode("list")}
                      className={`p-1.5 rounded-lg transition-all ${
                        orderModalViewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-blue-500"
                      }`}
                      title="عرض قائمة">
                      <List size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => setIsOrderModalMaximized(!isOrderModalMaximized)}
                    className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
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
              <div className="bg-blue-50/40 p-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    🛒 الفحوصات المختارة حالياً ({selectedServices.length}):
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
                  <div className="text-gray-400 text-xs font-semibold py-3 text-center bg-white/80 rounded-2xl border border-dashed border-gray-200 shadow-2xs">
                    لم تقم بتحديد أي فحص أو خدمة بعد. اختر من التصنيفات الجانبية أدناه لتعبئة السلة.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1 scrollbar-thin">
                    {selectedServices.map((svc, idx) => (
                      <div key={idx} className="bg-white border border-blue-200 hover:border-red-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-2xs text-[11px] font-black transition-all">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          svc.svcType === 'lab' ? 'bg-blue-500' : svc.svcType === 'radiology' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} />
                        <span className="text-gray-800">{svc.name}</span>
                        <span className="text-blue-700 font-extrabold font-sans">({svc.price} ريال)</span>
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
              <div className="bg-gray-50/70 p-3 border-b border-gray-150 flex-shrink-0 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2">
                  {[
                    { id: 'lab', label: 'التحاليل الطبية 🧪', colorClass: 'active:bg-blue-600 active:text-white', activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-100' },
                    { id: 'radiology', label: 'الأشعة التشخيصية ☢️', colorClass: 'active:bg-rose-600 active:text-white', activeClass: 'bg-rose-600 text-white shadow-md shadow-rose-100' },
                    { id: 'clinical', label: 'الخدمات السريرية 🩺', colorClass: 'active:bg-emerald-600 active:text-white', activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-100' },
                    { id: 'favorites', label: 'المفضلة ⭐', colorClass: 'active:bg-amber-500 active:text-white', activeClass: 'bg-amber-500 text-white shadow-md shadow-amber-100' },
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
                            : "bg-white text-gray-600 hover:bg-gray-100 border-gray-200"
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
              <div className="py-2 px-4 border-b border-gray-100 flex-shrink-0 bg-white">
                <div className="relative max-w-sm">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder={`بحث سريع بالاسم أو التصنيف (مثال: CBC، أشعة صدر)...`}
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="pr-9 pl-8 text-[11px] py-1.5 font-bold w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 rounded-xl outline-none transition-all shadow-sm"
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
                  <div className="w-64 border-l border-gray-150 overflow-y-auto flex-shrink-0 bg-gray-50/30 p-4 space-y-1.5 scrollbar-thin">
                    <span className="text-[10px] font-black text-gray-400 block mb-2 px-2">التصنيفات المتاحة:</span>
                    {(categorizedCatalog[activeModalDept] || []).length === 0 ? (
                      <div className="text-gray-400 text-[11px] font-bold p-4 text-center">لا توجد تصنيفات مدرجة</div>
                    ) : (
                      (categorizedCatalog[activeModalDept] || []).map((cat) => {
                        const isActive = activeModalCat === cat.name;
                        const CatIcon = cat.type === 'lab' ? FlaskConical : cat.type === 'radiology' ? Radiation : Layers;
                        
                        // Select border colors and text classes based on active state and department
                        let activeBtnStyle = "bg-blue-600 text-white shadow-md shadow-blue-100";
                        if (activeModalDept === 'radiology') activeBtnStyle = "bg-rose-600 text-white shadow-md shadow-rose-100";
                        if (activeModalDept === 'clinical') activeBtnStyle = "bg-emerald-600 text-white shadow-md shadow-emerald-100";

                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => setActiveModalCat(cat.name)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl text-right text-xs font-black transition-all ${
                              isActive
                                ? activeBtnStyle
                                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-150 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <CatIcon size={14} className={isActive ? "text-white" : "text-gray-400"} />
                              <span className="truncate max-w-[130px]">{cat.name}</span>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500 border border-gray-200"
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
                      activeTitle = "الفحوصات الطبية المفضلة للطبيب ⭐";
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
                          .filter(f => !selectedServices.some(s => s.id === f.id && s.svcType === s.svcType))
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
                        <div className="flex justify-between items-center pb-3 border-b border-gray-100 flex-shrink-0 mb-4 text-[11px] font-black text-gray-400">
                          <span className="flex items-center gap-1">
                            <Grid size={13} className="text-blue-500" />
                            {activeTitle} ({displayItems.length} عنصر)
                          </span>
                          {!modalSearchTerm && activeModalDept !== 'favorites' && (
                            <button
                              type="button"
                              onClick={handleToggleAll}
                              className="text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-3 py-1.5 rounded-xl transition-all border border-blue-200 flex items-center gap-1 cursor-pointer">
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

                              let checkedBorderClass = "bg-blue-50/40 border-blue-400 shadow-sm";
                              if (item.svcType === 'radiology') checkedBorderClass = "bg-rose-50/40 border-rose-400 shadow-sm";
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
                                      addService(item);
                                    }
                                  }}
                                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-2xs ${
                                    isChecked
                                      ? checkedBorderClass
                                      : "bg-white border-gray-200 hover:border-blue-300"
                                  }`}>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by click
                                        className="w-4 h-4 accent-blue-600 cursor-pointer rounded-lg"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <CatIcon size={13} className="text-gray-400 flex-shrink-0" />
                                        <p className="font-extrabold text-xs text-gray-800 leading-normal line-clamp-1">{item.name}</p>
                                      </div>
                                      <p className="text-[10px] text-gray-400 font-bold mt-1">
                                        {item.category_name || (item.svcType === "clinical" ? "خدمة سريرية" : "")} ·{" "}
                                        <strong className="text-blue-700 font-extrabold font-sans">{itemPrice} ريال</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFavoriteTest(item, item.svcType);
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

              {/* 6. Modal Footer */}
              <div className="p-4 border-t border-gray-150 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-3.5 flex-shrink-0">
                <div className="flex flex-col text-right">
                  <span className="text-[10px] font-black text-gray-500 mb-0.5">
                    إجمالي الفحوصات والخدمات المحددة
                  </span>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-black text-gray-900">
                      {selectedServices.length} خدمات
                    </strong>
                    {selectedServices.length > 0 && (
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-md">
                        جاهز للحفظ
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-95 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2">
                    <Save size={15} />
                    حفظ وإغلاق الكتالوج
                  </button>
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm">
                    إلغاء الأمر
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DOCUMENT PREVIEW MODAL ── */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
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
                    <Eye size={18} className="text-blue-600 animate-pulse" />{" "}
                    استعراض مستند النتيجة الطبية
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
