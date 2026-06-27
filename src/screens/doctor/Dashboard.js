import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  ClipboardList,
  Wallet,
  Stethoscope,
  FlaskConical,
  Radiation,
  Scissors,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Tag,
  ArrowUpRight,
  Award,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "react-toastify";
import useAuthStore from "../../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import taffyot from "../../utils/taffyot";

// Custom Recharts Tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl shadow-xl p-3 text-right"
      dir="rtl">
      <p className="font-bold text-gray-500 text-xs mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold text-blue-700 text-sm">
          {p.name}: {p.value} مريض
        </p>
      ))}
    </div>
  );
};

// KPI Card component
const KpiCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  details,
  colorClass,
  gradientClass,
}) => (
  <motion.div
    whileHover={{ y: -4, shadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative overflow-hidden group transition-all">
    <div
      className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-5 bg-gradient-to-br ${gradientClass} group-hover:scale-110 transition-transform duration-500`}
    />
    <div className="flex justify-between items-start">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${colorClass}`}>
        <Icon size={22} />
      </div>
      <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 uppercase tracking-wider">
        اليوم
      </span>
    </div>
    <div className="mt-4">
      <h3 className="text-2xl font-black text-gray-800">{value}</h3>
      {subtitle && (
        <p className="text-[9px] font-black text-purple-650 mt-0.5 leading-normal">
          {subtitle}
        </p>
      )}
      <p className="text-sm font-semibold text-gray-500 mt-0.5">{title}</p>
    </div>
    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-gray-400">
      {details.map((d, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${d.dotClass}`} />
          {d.label}:{" "}
          <strong className="text-gray-700 font-extrabold">{d.value}</strong>
        </span>
      ))}
    </div>
  </motion.div>
);

export default function DoctorDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const fetchStats = async () => {
    try {
      const res = await axios.get("/api/doctor/dashboard-stats", { headers });
      setStats(res.data);
    } catch {
      toast.error("خطأ في تحميل إحصائيات لوحة القيادة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [headers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-bold">
            جاري تحميل لوحة القيادة...
          </p>
        </div>
      </div>
    );
  }

  const {
    patientsFlow = {},
    procedures = {},
    financial = {},
    chart = [],
  } = stats || {};

  const formattedDiscounts = taffyot(financial.discounts || 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header banner */}
      <div className="relative overflow-hidden bg-gradient-to-l from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
              أهلاً بك {user?.fullName || "الطبيب"} 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 font-semibold opacity-90 max-w-lg leading-relaxed">
              إليك ملخص النشاط الطبي والعمليات الجارية في العيادة لليوم الحالي.
              نتمنى لك يوماً طبياً موفقاً ومثمراً.
            </p>
          </div>
          <button
            onClick={() => navigate("/doctor/queue")}
            className="px-5 py-3 bg-white text-blue-800 font-extrabold text-sm rounded-2xl hover:bg-blue-50 transition-colors shadow-md hover:scale-102 flex items-center gap-2">
            <Stethoscope size={18} /> مساحة العمل السريرية
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <KpiCard
          icon={Users}
          title="تدفق المرضى اليوم"
          value={`${patientsFlow.total || 0} مريض`}
          colorClass="bg-blue-600 shadow-blue-200"
          gradientClass="from-blue-600 to-indigo-600"
          details={[
            {
              label: "بانتظار الدخول",
              value: patientsFlow.waiting || 0,
              dotClass: "bg-amber-400 animate-pulse",
            },
            {
              label: "تم معاينتهم",
              value: patientsFlow.completed || 0,
              dotClass: "bg-emerald-500",
            },
          ]}
        />

        <KpiCard
          icon={Activity}
          title="الإجراءات الطبية المطلوبة"
          value={`${procedures.total || 0} طلب`}
          colorClass="bg-rose-500 shadow-rose-200"
          gradientClass="from-rose-500 to-pink-500"
          details={[
            {
              label: "قيد الانتظار/التنفيذ",
              value: procedures.awaiting || 0,
              dotClass: "bg-amber-400 animate-pulse",
            },
            {
              label: "اكتملت نتائجها",
              value: procedures.completed || 0,
              dotClass: "bg-emerald-500",
            },
          ]}
        />

        <KpiCard
          icon={Wallet}
          title="النشاط المالي والتخفيضات"
          value={`${(financial.discounts || 0).toLocaleString()} ريال`}
          subtitle={
            financial.discounts > 0 ? `(${formattedDiscounts})` : undefined
          }
          colorClass="bg-purple-600 shadow-purple-200"
          gradientClass="from-purple-600 to-violet-600"
          details={[
            {
              label: "مبلغ الخصم الكلي",
              value: (financial.discounts || 0).toLocaleString(),
              dotClass: "bg-purple-500",
            },
            {
              label: "حالات الإعفاء (VIP)",
              value: financial.exemptCount || 0,
              dotClass: "bg-emerald-500",
            },
          ]}
        />
      </div>

      {/* Charts & Actions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Patient Activity Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-gray-800 text-base">
                منحنى تدفق الحالات
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                معدل تسجيل المرضى خلال الـ 7 أيام الأخيرة
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
              <TrendingUp size={14} className="text-blue-500" />
              تحديث تلقائي
            </div>
          </div>
          <div className="flex-1 min-h-[220px]">
            {chart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm font-semibold">
                لا يوجد بيانات كافية للرسم
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chart}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient
                      id="colorPatients"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">
                      <stop
                        offset="5%"
                        stopColor="#2563EB"
                        stopOpacity={0.15}
                      />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#F3F4F6"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="إجمالي المرضى"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#colorPatients)"
                    dot={{
                      r: 4,
                      stroke: "#2563EB",
                      strokeWidth: 2,
                      fill: "#FFF",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-gray-800 text-base mb-1">
              الوصول السريع والإجراءات
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              مفاتيح انتقال سريع لإجراء المهام الطبية اليومية
            </p>

            <div className="space-y-3">
              <button
                onClick={() => navigate("/doctor/queue")}
                className="w-full flex items-center justify-between p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl group transition-all text-right">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <span className="font-extrabold text-blue-900 text-sm block">
                      غرفة المعاينة والانتظار
                    </span>
                    <p className="text-[11px] font-semibold text-blue-600 mt-0.5">
                      معاينة المرضى الجدد وطلبات الخدمات
                    </p>
                  </div>
                </div>
                <ArrowUpRight
                  size={18}
                  className="text-blue-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all"
                />
              </button>

              <button
                onClick={() => navigate("/settings")}
                className="w-full flex items-center justify-between p-4 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-2xl group transition-all text-right">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Award size={18} />
                  </div>
                  <div>
                    <span className="font-extrabold text-indigo-900 text-sm block">
                      الملف الشخصي والحماية
                    </span>
                    <p className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                      تعديل المظهر، حماية الحساب وطلبات السر
                    </p>
                  </div>
                </div>
                <ArrowUpRight
                  size={18}
                  className="text-indigo-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-[-2px] transition-all"
                />
              </button>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-50 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 text-center flex items-center gap-3 text-right">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold text-lg">
              💡
            </div>
            <p className="text-[10px] text-gray-500 font-bold leading-normal">
              تعتمد لوحة القيادة على التزامن التلقائي اللحظي. بمجرد دفع مريض
              رسومه أو تسجيله بالاستقبال، يتم تحديث الأرقام فوراً.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
