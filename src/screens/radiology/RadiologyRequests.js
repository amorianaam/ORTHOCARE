import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radiation,
  Search,
  Check,
  RefreshCcw,
  X,
  Upload,
  CheckCircle,
  Film,
  Image as ImageIcon,
  Clock,
  CheckSquare,
  BarChart3,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  Maximize2,
  Minimize2,
  LayoutGrid,
  List,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-toastify";
import useAuthStore from "../../store/useAuthStore";
import { getSocket } from "../../utils/socket";

// ── Upload Result Modal ───────────────────────────────────────────
const UploadResultModal = ({
  title,
  endpoint,
  initialNotes,
  initialFiles,
  onClose,
  onUploaded,
  token,
}) => {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialFiles) {
      try {
        setFiles(JSON.parse(initialFiles));
      } catch {}
    }
  }, [initialFiles]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    for (let file of selectedFiles) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`الملف ${file.name} كبير جداً (أكثر من 10MB)`);
        return;
      }
    }

    let loadedCount = 0;
    const newFiles = [];
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        newFiles.push({
          name: file.name,
          base64: reader.result,
          type: file.type,
        });
        loadedCount++;
        if (loadedCount === selectedFiles.length) {
          setFiles((prev) => [...prev, ...newFiles]);
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resultFile = files.length > 0 ? JSON.stringify(files) : null;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resultFile, resultNotes: notes }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        onUploaded();
        onClose();
      } else toast.error(data.message);
    } catch {
      toast.error("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      dir="rtl">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
        <h3 className="font-bold text-gray-800 text-lg mb-4">
          إرفاق التقرير الطبي
        </h3>
        <div className="mb-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
          <p className="font-bold text-base text-orange-800">{title}</p>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              التقرير والملاحظات السريرية (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="اكتب التقرير الإشعاعي هنا..."
              className="input-base text-sm resize-none bg-gray-50 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700">
              الصور الشعاعية والمرفقات ({files.length})
            </label>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,image/*"
              multiple
            />
            {files.length > 0 && (
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-100">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-white p-2.5 border rounded-lg shadow-sm text-xs">
                    <span className="truncate max-w-[250px] font-semibold">
                      {f.name}
                    </span>
                    <button
                      onClick={() =>
                        setFiles((p) => p.filter((_, i) => i !== idx))
                      }
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current.click()}
              className="w-full py-4 rounded-xl border-2 border-dashed border-orange-200 text-orange-600 hover:border-orange-500 hover:bg-orange-50 flex items-center justify-center gap-2 text-sm font-bold transition-colors">
              <Upload size={18} /> إرفاق مستندات (PDF / صور)
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-5 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary bg-orange-600 hover:bg-orange-700 flex-1 flex items-center justify-center gap-2 py-3">
            {saving ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <Check size={18} />
            )}
            حفظ واعتماد التقرير
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary px-8 py-3">
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Film Grouping Modal ───────────────────────────────────────────
const FilmGroupingModal = ({
  visitId,
  requests,
  token,
  onClose,
  onGrouped,
}) => {
  const [filmSize, setFilmSize] = useState("large");
  const [selectedReqs, setSelectedReqs] = useState([]);
  const [saving, setSaving] = useState(false);

  const unassigned = requests.filter(
    (r) => r.with_film === 1 && !r.radiology_film_id,
  );

  const handleSave = async () => {
    if (selectedReqs.length === 0)
      return toast.error("حدد فحصاً واحداً على الأقل");
    if (filmSize === "large" && selectedReqs.length > 3)
      return toast.error("الفيلم الكبير لا يتسع لأكثر من 3 فحوصات");
    if (filmSize === "small" && selectedReqs.length > 2)
      return toast.error("الفيلم الصغير لا يتسع لأكثر من فحصين");

    setSaving(true);
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}/films`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filmSize, requestIds: selectedReqs }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onGrouped();
        onClose();
      } else toast.error(d.message);
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (id) => {
    if (selectedReqs.includes(id)) {
      setSelectedReqs(selectedReqs.filter((r) => r !== id));
    } else {
      if (filmSize === "large" && selectedReqs.length >= 3)
        return toast.error("الحد الأقصى للفيلم الكبير هو 3 فحوصات");
      if (filmSize === "small" && selectedReqs.length >= 2)
        return toast.error("الحد الأقصى للفيلم الصغير هو فحصين");
      setSelectedReqs([...selectedReqs, id]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      dir="rtl">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-800 text-xl mb-5 flex items-center gap-2">
          <Film size={24} className="text-orange-600" /> إعداد فيلم التصوير
          الطبي
        </h3>

        <div className="mb-6">
          <label className="block text-sm font-bold mb-3 text-gray-700">
            مقاس الفيلم الإشعاعي
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFilmSize("large");
                setSelectedReqs([]);
              }}
              className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center justify-center gap-1 ${filmSize === "large" ? "border-orange-600 bg-orange-50 text-orange-700 shadow-sm" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              <span className="text-base">كبير (Large)</span>
              <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                أقصى حد: 3 دراسات
              </span>
            </button>
            <button
              onClick={() => {
                setFilmSize("small");
                setSelectedReqs([]);
              }}
              className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center justify-center gap-1 ${filmSize === "small" ? "border-orange-600 bg-orange-50 text-orange-700 shadow-sm" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              <span className="text-base">صغير (Small)</span>
              <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                أقصى حد: دراستان
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold mb-3 text-gray-700">
            الإشعة المحددة للطباعة
          </label>
          {unassigned.length === 0 ? (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-100">
              <CheckCircle size={20} /> جميع الأشعة مكتملة الإدراج.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto p-1 custom-scrollbar">
              {unassigned.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleToggle(r.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selectedReqs.includes(r.id) ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-orange-300 bg-white"}`}>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedReqs.includes(r.id) ? "bg-orange-600 border-orange-600 text-white" : "border-gray-300 bg-white"}`}>
                    {selectedReqs.includes(r.id) && <Check size={14} />}
                  </div>
                  <span className="font-bold text-sm text-gray-800">
                    {r.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-5 border-t">
          <button
            onClick={handleSave}
            disabled={saving || selectedReqs.length === 0}
            className="btn-primary bg-orange-600 hover:bg-orange-700 flex-1 py-3 text-base">
            اعتماد الفيلم المطبوع
          </button>
          <button onClick={onClose} className="btn-secondary px-8 py-3">
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Patient Detail Panel (Centered Modal) ──────────────────────────
const PatientDetailPanel = ({
  visitId,
  token,
  onClose,
  onCompleted,
  onStartAll,
  isCompletedTab,
  isPendingTab,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingItem, setUploadingItem] = useState(null); // { type: 'film'|'request', item: object }
  const [groupingMode, setGroupingMode] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(await res.json());
    } catch {
      toast.error("فشل تحميل التفاصيل");
    } finally {
      setLoading(false);
    }
  }, [visitId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteFilm = async (filmId) => {
    if (
      !window.confirm(
        "هل أنت متأكد من فك تجميع هذا الفيلم؟ ستفقد النتيجة المشتركة إذا كانت موجودة.",
      )
    )
      return;
    try {
      await fetch(`/api/radiology/films/${filmId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("تم حذف الفيلم وفك ارتباط الفحوصات");
      load();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const handleFinishPatient = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}/complete`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onCompleted();
        onClose();
      } else toast.error(d.message);
    } catch {
      toast.error("تعذر الاتصال");
    } finally {
      setCompleting(false);
    }
  };

  const requests = data?.requests || [];
  const films = data?.films || [];
  const unassignedFilmsCount = requests.filter(
    (r) => r.with_film === 1 && !r.radiology_film_id,
  ).length;
  const isAllDone = requests.every((r) => r.status === "completed");

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center ${isFullscreen ? "p-0" : "p-4 sm:p-6 lg:p-8"}`}
      dir="rtl">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative z-10 bg-white flex flex-col overflow-hidden border border-gray-100 transition-all duration-300 ${
          isFullscreen
            ? "w-screen h-screen rounded-none shadow-none max-w-none"
            : "w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh]"
        }`}>
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex justify-between items-center relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #FFEDD5, #FED7AA)" }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500 opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-600 opacity-5 rounded-full translate-y-1/3 -translate-x-1/4"></div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              {data?.visit?.full_name?.charAt(0) || <Radiation size={24} />}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg tracking-tight">
                {data?.visit?.full_name || "جاري التحميل..."}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-orange-900/80">
                <span className="bg-orange-500/20 px-2 py-0.5 rounded-md">
                  العمر: {data?.visit?.age} سنة
                </span>
                <span className="bg-orange-500/20 px-2 py-0.5 rounded-md">
                  الرقم المرجعي: {data?.visit?.visit_number}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white/40 hover:bg-white/80 rounded-lg transition-all shadow-sm text-orange-900"
              title={isFullscreen ? "تصغير" : "ملء الشاشة"}>
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white/40 hover:bg-white/80 rounded-lg transition-all shadow-sm text-orange-900">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50 custom-scrollbar relative">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 h-full">
              {/* Left Column (Scans List) */}
              <div
                className={`${isPendingTab ? "xl:col-span-12" : "xl:col-span-7"} space-y-5 flex flex-col min-h-0`}>
                <div className="flex flex-col h-full">
                  <h4 className="font-bold text-gray-800 text-base flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Radiation size={18} className="text-orange-600" /> الإشعة
                      المطلوبة
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md text-xs">
                        {requests.length} أشعة
                      </span>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-1 rounded-md transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
                        title="عرض شبكي">
                        <LayoutGrid size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`p-1 rounded-md transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-orange-600" : "text-gray-400 hover:text-gray-600"}`}
                        title="عرض قائمة">
                        <List size={16} />
                      </button>
                    </div>
                  </h4>

                  <div
                    className={`overflow-y-auto pr-1 custom-scrollbar flex-1 ${viewMode === "grid" ? `grid grid-cols-1 ${isPendingTab ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3 content-start` : "flex flex-col gap-3"}`}>
                    {requests.map((req) => {
                      const isGrouped =
                        req.with_film === 1 && req.radiology_film_id;
                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-xl border transition-all shadow-sm flex ${viewMode === "grid" ? "flex-col justify-between" : "flex-row items-center justify-between gap-4"} ${req.status === "completed" ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-white hover:border-orange-200"}`}>
                          <div
                            className={
                              viewMode === "list"
                                ? "flex-1 flex justify-between items-center"
                                : ""
                            }>
                            <div
                              className={`flex ${viewMode === "list" ? "items-center gap-3" : "justify-between items-start mb-2"}`}>
                              <p className="font-bold text-gray-800 text-sm leading-tight pr-2">
                                {req.name}
                              </p>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${req.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                                {req.status === "completed"
                                  ? "مكتمل"
                                  : "قيد التنفيذ"}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              {req.with_film === 1 ? (
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${req.radiology_film_id ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                                  <Film size={10} />{" "}
                                  {req.radiology_film_id
                                    ? "تم الإدراج في فيلم"
                                    : "قيد انتظار الطباعة"}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-semibold flex items-center gap-1 border border-gray-200">
                                  <ImageIcon size={10} />
                                  بدون فيلم
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Upload Result Button (ONLY if not grouped) */}
                          {!isPendingTab && (
                            <div
                              className={
                                viewMode === "list"
                                  ? "flex-shrink-0"
                                  : "mt-3 pt-2 border-t border-gray-100 flex justify-end"
                              }>
                              {isGrouped ? (
                                <p className="text-[10px] font-bold text-gray-400 w-full text-center bg-gray-50 px-2 py-1.5 rounded-md">
                                  التقرير مرتبط بالفيلم
                                </p>
                              ) : (
                                <button
                                  onClick={() =>
                                    setUploadingItem({
                                      type: "request",
                                      item: req,
                                    })
                                  }
                                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all flex justify-center items-center gap-1.5 ${req.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-600 hover:text-white"} ${viewMode === "grid" ? "w-full" : ""}`}>
                                  {req.status === "completed" ? (
                                    <>
                                      <CheckSquare size={14} /> تحديث التقرير
                                    </>
                                  ) : (
                                    <>
                                      <Upload size={14} /> إرفاق التقرير
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column (Film Management) */}
              {!isPendingTab && (
                <div className="xl:col-span-5">
                  {requests.some((r) => r.with_film === 1) ? (
                    <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm h-full flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-orange-50">
                        <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                          <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
                            <Film size={18} />
                          </div>
                          أفلام التصوير الطبي
                        </h4>
                        <button
                          onClick={() => setGroupingMode(true)}
                          disabled={unassignedFilmsCount === 0}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-sm ${unassignedFilmsCount > 0 ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                          <Plus size={14} /> إضافة إلى فيلم
                        </button>
                      </div>

                      {unassignedFilmsCount > 0 && (
                        <div className="mb-5 text-sm bg-red-50 text-red-700 p-4 rounded-2xl font-bold flex items-center gap-3 border-2 border-red-100 shadow-sm">
                          <AlertCircle
                            size={24}
                            className="flex-shrink-0 animate-pulse"
                          />
                          <span>
                            يوجد {unassignedFilmsCount} أشعة تتطلب التصدير إلى
                            فيلم!
                          </span>
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                        {films.length > 0 ? (
                          films.map((f) => {
                            const filmRequests = requests.filter(
                              (r) => r.radiology_film_id === f.id,
                            );
                            const isFilmCompleted = filmRequests.every(
                              (r) => r.status === "completed",
                            );

                            return (
                              <div
                                key={f.id}
                                className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm hover:border-orange-200 transition-colors group">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`p-2.5 rounded-xl font-black text-sm flex flex-col items-center justify-center w-14 h-14 ${f.film_size === "large" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                                      <Film size={20} className="mb-0.5" />
                                      <span>
                                        {f.film_size === "large"
                                          ? "كبير"
                                          : "صغير"}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-800 text-sm mb-1">
                                        {filmRequests.length} دراسات مدرجة
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {filmRequests.map((r) => (
                                          <span
                                            key={r.id}
                                            className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold border border-gray-200">
                                            {r.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteFilm(f.id)}
                                    className="text-gray-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
                                    title="إلغاء التجميع">
                                    <Trash2 size={18} />
                                  </button>
                                </div>

                                {/* Shared Result Button for the Film */}
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <button
                                    onClick={() =>
                                      setUploadingItem({
                                        type: "film",
                                        item: f,
                                        requests: filmRequests,
                                      })
                                    }
                                    className={`w-full text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all flex justify-center items-center gap-1.5 ${isFilmCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white"}`}>
                                    {isFilmCompleted ? (
                                      <>
                                        <CheckSquare size={14} /> تحديث التقرير
                                        الإشعاعي
                                      </>
                                    ) : (
                                      <>
                                        <Upload size={14} /> إرفاق التقرير
                                        المشترك
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <ImageIcon
                              size={32}
                              className="text-gray-300 mb-2"
                            />
                            <p className="font-bold text-sm text-gray-500">
                              لم يتم إدراج أي أفلام حتى الآن.
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              انقر على "تصدير إلى فيلم" للبدء في الطباعة.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm h-full flex flex-col items-center justify-center text-center">
                      <ImageIcon size={48} className="text-gray-200 mb-3" />
                      <p className="font-bold text-gray-500 text-base">
                        بدون فيلم
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        يُرجى إرفاق التقرير لكل أشعة بشكل مستقل.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isCompletedTab && !isPendingTab && (
          <div className="px-5 py-4 border-t bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] relative z-20">
            <button
              onClick={handleFinishPatient}
              disabled={completing || loading || unassignedFilmsCount > 0}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base transition-all shadow-sm ${
                isAllDone && unassignedFilmsCount === 0
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-emerald-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none"
              }`}>
              {completing ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <CheckCircle size={18} />
              )}
              اعتماد النتائج وإرسالها للطبيب المعالج
            </button>
          </div>
        )}
        {isPendingTab && (
          <div className="px-5 py-4 border-t bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] relative z-20">
            <button
              onClick={() => {
                onStartAll(visitId);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-base transition-all shadow-sm bg-orange-600 hover:bg-orange-700 text-white">
              <CheckCircle size={18} />
              تحويل المريض لغرفة التصوير (البدء بالإجراء)
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {uploadingItem && (
          <UploadResultModal
            token={token}
            title={
              uploadingItem.type === "film"
                ? `رفع النتيجة المشتركة (فيلم ${uploadingItem.item.film_size === "large" ? "كبير" : "صغير"})`
                : `رفع نتيجة: ${uploadingItem.item.name}`
            }
            endpoint={
              uploadingItem.type === "film"
                ? `/api/radiology/films/${uploadingItem.item.id}/result`
                : `/api/radiology/request/${uploadingItem.item.id}/result`
            }
            initialNotes={
              uploadingItem.type === "film"
                ? uploadingItem.requests[0]?.result_notes
                : uploadingItem.item.result_notes
            }
            initialFiles={
              uploadingItem.type === "film"
                ? uploadingItem.requests[0]?.result_file
                : uploadingItem.item.result_file
            }
            onClose={() => setUploadingItem(null)}
            onUploaded={load}
          />
        )}
        {groupingMode && (
          <FilmGroupingModal
            visitId={visitId}
            requests={requests}
            token={token}
            onClose={() => setGroupingMode(false)}
            onGrouped={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

import { TrendingUp, BookOpen } from "lucide-react";

// ── Reports Tab ───────────────────────────────────────────────────
const ReportsPanel = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/radiology/stats?";

      if (dateFilter === "custom" && customRange.start && customRange.end) {
        url += `startDate=${customRange.start}&endDate=${customRange.end}`;
      } else if (dateFilter !== "all") {
        const now = new Date();
        let start = "";
        const pad = (n) => n.toString().padStart(2, "0");
        const format = (d) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (dateFilter === "today") {
          start = format(now);
        } else if (dateFilter === "week") {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          start = format(past);
        } else if (dateFilter === "month") {
          const past = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            now.getDate(),
          );
          start = format(past);
        }
        url += `startDate=${start}&endDate=${format(now)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(await res.json());
    } catch {
      toast.error("فشل تحميل الإحصائيات");
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleResetFilters = () => {
    setDateFilter("all");
    setCustomRange({ start: "", end: "" });
    toast.info("تم إعادة تعيين فلاتر التقارير");
  };

  const groupedData = useMemo(() => {
    if (!stats?.tableData) return [];
    const map = new Map();
    stats.tableData.forEach((row) => {
      if (!map.has(row.visit_number)) {
        map.set(row.visit_number, {
          visit_number: row.visit_number,
          patient_name: row.patient_name,
          date: row.date,
          total_scans: 0,
          large_films: 0,
          small_films: 0,
          without_films: 0,
          details: [],
        });
      }
      const group = map.get(row.visit_number);
      const scansCount = parseInt(row.scans_in_film || 1, 10);
      group.total_scans += scansCount;

      if (row.film_size === "large") group.large_films += 1;
      else if (row.film_size === "small") group.small_films += 1;
      else group.without_films += scansCount;

      if (new Date(row.date) > new Date(group.date)) {
        group.date = row.date;
      }
      group.details.push(row);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [stats?.tableData]);

  return (
    <div className="flex-1 overflow-y-auto space-y-6 w-full custom-scrollbar pr-2 pb-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-orange-900 to-slate-900 p-6 rounded-3xl text-white border border-orange-950 shadow-lg relative overflow-hidden flex-shrink-0 mt-2">
        <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-700/80 flex items-center justify-center text-orange-200 shadow-inner">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">
                تقارير الأداء والإحصائيات التحليلية
              </h1>
              <p className="text-slate-400 text-xs mt-1">
                تتبع استهلاك أفلام التصوير الطبي وعدد الإشعة المنجزة
              </p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            className="btn-secondary bg-slate-800 hover:bg-slate-700 border-none text-slate-200 flex items-center gap-2 text-xs py-2 shadow-md">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />{" "}
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-bold text-gray-500">
            {[
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "آخر 7 أيام" },
              { id: "month", label: "آخر 30 يوماً" },
              { id: "custom", label: "تاريخ مخصص" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  dateFilter === f.id
                    ? "bg-white text-orange-800 shadow-sm"
                    : "hover:bg-white/40"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter !== "all" && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors">
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Custom Range Picker */}
        <AnimatePresence>
          {dateFilter === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">من تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) =>
                      setCustomRange({ ...customRange, start: e.target.value })
                    }
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) =>
                      setCustomRange({ ...customRange, end: e.target.value })
                    }
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* KPI Overviews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 flex-shrink-0">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-orange-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">
                  أفلام كبيرة مستخدمة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.large_films || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Film size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">
                  أفلام صغيرة مستخدمة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.small_films || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                <Film size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-gray-300 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">
                  حفظ رقمي بدون فيلم
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.without_film || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-gray-50 text-gray-500 rounded-2xl flex items-center justify-center shadow-inner">
                <ImageIcon size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">
                  إجمالي الأشعة المنجزة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.total_operations || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                <BarChart3 size={20} />
              </div>
            </div>
          </div>

          {/* Table Data Render */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-shrink-0">
            <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center gap-2">
              <BookOpen size={18} className="text-gray-400" />
              <h4 className="font-black text-gray-700 text-sm">
                سجل استهلاك أفلام التصوير والأشعة
              </h4>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-150 text-xs font-bold">
                  <tr>
                    <th className="px-5 py-3">المعرف (الرقم المرجعي)</th>
                    <th className="px-5 py-3">الاسم</th>
                    <th className="px-5 py-3">الأفلام المستهلكة</th>
                    <th className="px-5 py-3">إجمالي الأشعة</th>
                    <th className="px-5 py-3">التاريخ والوقت</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-10 text-center text-gray-400 font-bold text-xs">
                        لا يوجد سجلات استهلاك في هذه الفترة.
                      </td>
                    </tr>
                  ) : (
                    groupedData.map((group, i) => (
                      <React.Fragment key={group.visit_number}>
                        {/* Main Group Row */}
                        <tr
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === group.visit_number
                                ? null
                                : group.visit_number,
                            )
                          }
                          className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer group">
                          <td className="px-5 py-4 font-black text-gray-500 text-xs bg-gray-50/50">
                            {group.visit_number}
                          </td>
                          <td className="px-5 py-4 font-extrabold text-gray-800">
                            {group.patient_name}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              {group.large_films > 0 && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-[10px] font-black border border-orange-200">
                                  {group.large_films} فيلم كبير
                                </span>
                              )}
                              {group.small_films > 0 && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black border border-blue-200">
                                  {group.small_films} فيلم صغير
                                </span>
                              )}
                              {group.without_films > 0 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-black border border-gray-200">
                                  {group.without_films} بدون فيلم
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-black text-gray-700">
                            {group.total_scans}{" "}
                            <span className="text-gray-400 font-bold text-[10px]">
                              أشعة
                            </span>
                          </td>
                          <td
                            className="px-5 py-4 font-bold text-gray-500 text-xs"
                            dir="ltr">
                            {new Date(group.date).toLocaleString("ar-EG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                              <ChevronDown
                                size={16}
                                className={`transition-transform duration-300 ${expandedRow === group.visit_number ? "rotate-180" : ""}`}
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        <AnimatePresence>
                          {expandedRow === group.visit_number && (
                            <tr className="bg-gray-50/30">
                              <td
                                colSpan="6"
                                className="p-0 border-b border-gray-100">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden">
                                  <div className="p-6">
                                    <div className="bg-white rounded-2xl border border-gray-150 p-1 shadow-sm">
                                      <table className="w-full text-xs text-right">
                                        <thead className="bg-gray-50 text-gray-500 rounded-t-xl font-bold">
                                          <tr>
                                            <th className="px-4 py-2 rounded-tr-xl">
                                              النوع (الفيلم)
                                            </th>
                                            <th className="px-4 py-2">
                                              عدد الأشعة
                                            </th>
                                            <th className="px-4 py-2 rounded-tl-xl">
                                              الأشعة المنفذة
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.details.map((detail, idx) => (
                                            <tr
                                              key={idx}
                                              className="border-t border-gray-50 hover:bg-gray-50/50">
                                              <td className="px-4 py-3">
                                                <span
                                                  className={`px-2 py-1 rounded text-[10px] font-black inline-flex items-center gap-1 ${
                                                    detail.film_size === "large"
                                                      ? "bg-orange-50 text-orange-600 border border-orange-100"
                                                      : detail.film_size ===
                                                          "small"
                                                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                                                        : "bg-gray-100 text-gray-600 border border-gray-200"
                                                  }`}>
                                                  {detail.film_size !==
                                                    "none" && (
                                                    <Film size={10} />
                                                  )}
                                                  {detail.film_size === "large"
                                                    ? "فيلم كبير"
                                                    : detail.film_size ===
                                                        "small"
                                                      ? "فيلم صغير"
                                                      : "بدون فيلم"}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 font-bold text-gray-700">
                                                {detail.scans_in_film}
                                              </td>
                                              <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                  {detail.scan_names
                                                    ?.split(" - ")
                                                    .map((name, nIdx) => (
                                                      <span
                                                        key={nIdx}
                                                        className="bg-white border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold text-gray-600">
                                                        {name.trim()}
                                                      </span>
                                                    ))}
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main Dashboard (Sidebar Navigation replaces Tabs) ─────────────
const RadiologyRequests = ({ tab = "pending" }) => {
  const { token } = useAuthStore();
  const activeTab = tab; // using prop instead of internal state
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [dates, setDates] = useState({ start: "", end: "" });

  const fetchRequests = useCallback(async () => {
    if (activeTab === "reports") return;
    setLoading(true);
    try {
      let url = `/api/radiology/requests?tab=${activeTab}`;
      if (activeTab === "completed") {
        // Force today's date for completed tab
        const today = new Date().toLocaleDateString("en-CA"); // 'YYYY-MM-DD' in local timezone
        url += `&startDate=${today}&endDate=${today}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(await res.json());
    } catch {
      toast.error("فشل تحميل القائمة");
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, dates]);

  useEffect(() => {
    fetchRequests();
    const socket = getSocket();
    socket.on("request:new", fetchRequests);
    socket.on("radiology:updated", fetchRequests);
    return () => {
      socket.off("request:new", fetchRequests);
      socket.off("radiology:updated", fetchRequests);
    };
  }, [fetchRequests]);

  const handleStartAll = async (visitId) => {
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}/start-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        fetchRequests();
      } else toast.error(d.message);
    } catch {
      toast.error("فشل التنفيذ");
    }
  };

  const filtered = requests.filter(
    (r) =>
      !query || r.full_name.includes(query) || r.visit_number.includes(query),
  );

  // Determine Title text
  let titleText = "نظام المعلومات الإشعاعية (RIS)";
  let IconComp = Radiation;
  if (activeTab === "pending") {
    titleText = "الطلبات الإشعاعية الواردة";
    IconComp = Clock;
  } else if (activeTab === "in_progress") {
    titleText = "التصوير قيد الإجراء";
    IconComp = Radiation;
  } else if (activeTab === "completed") {
    titleText = "الفحوصات الإشعاعية المنجزة";
    IconComp = CheckSquare;
  } else if (activeTab === "reports") {
    titleText = "تقارير الأداء والإحصائيات";
    IconComp = BarChart3;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50" dir="rtl">
      {/* Header Info only (Tabs removed) */}

      <div className="flex gap-5 flex-1 min-h-0 w-full">
        {activeTab === "reports" ? (
          <ReportsPanel token={token} />
        ) : (
          <div className="flex-1 flex flex-col min-w-0 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm w-full">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
              <div className="relative w-full md:w-96">
                <Search
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 text-gray-900 text-sm rounded-2xl focus:ring-orange-500 focus:border-orange-500 block pr-12 py-3.5 font-bold transition-all"
                  placeholder="بحث سريع باسم المريض أو رقم الزيارة..."
                />
              </div>
              <button
                onClick={fetchRequests}
                className="h-12 w-12 flex flex-shrink-0 items-center justify-center p-0 rounded-2xl bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white transition-all border border-orange-100 shadow-sm">
                <RefreshCcw
                  size={20}
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar w-full">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-32 bg-gray-50 rounded-3xl animate-pulse border-2 border-gray-100"
                  />
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Radiation size={72} className="mb-5 opacity-20" />
                  <p className="font-black text-2xl text-gray-300">
                    لا توجد سجلات مطابقة
                  </p>
                </div>
              ) : (
                filtered.map((v, i) => {
                  const isActive = selected?.visit_id === v.visit_id;
                  return (
                    <motion.div
                      key={v.visit_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelected(v)}
                      className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                        isActive
                          ? "border-orange-500 shadow-md bg-orange-50/40 ring-2 ring-orange-50 scale-[1.01]"
                          : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm"
                      }`}>
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${
                              activeTab === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700"
                            }`}>
                            {v.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">
                              {v.full_name}
                            </p>
                            <p className="text-xs font-semibold text-gray-500 mt-1 flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                العمر: {v.age} سنة
                              </span>
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                الرقم المرجعي: {v.visit_number}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-left flex flex-col items-end gap-1.5">
                            <span className="text-xs font-bold bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">
                              {v.total_tests} إجراءات مطلوبة
                            </span>
                            {v.tests_with_film > 0 && (
                              <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <Film size={12} /> متضمنة أفلام تصوير
                              </span>
                            )}
                          </div>

                          {activeTab === "pending" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartAll(v.visit_id);
                              }}
                              className="text-sm font-bold bg-orange-600 text-white px-5 py-2.5 rounded-xl hover:bg-orange-700 shadow-sm transition-all active:scale-95 flex items-center gap-2">
                              <CheckCircle size={18} /> تحويل لغرفة التصوير
                            </button>
                          )}
                          {activeTab !== "pending" && (
                            <div className="text-orange-400 bg-orange-50 p-2 rounded-xl">
                              <ChevronLeft size={20} />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {selected && (
          <PatientDetailPanel
            visitId={selected.visit_id}
            token={token}
            isCompletedTab={activeTab === "completed"}
            isPendingTab={activeTab === "pending"}
            onStartAll={handleStartAll}
            onClose={() => setSelected(null)}
            onCompleted={() => {
              fetchRequests();
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ChevronLeft = ({ size, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export default RadiologyRequests;
