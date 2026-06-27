import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Activity, Calendar, TrendingUp,
  FlaskConical, Radiation, Scissors, DollarSign,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ─── MOCK DATA ──────────────────────────────────────────────────────
const DAILY_VISITS = [
  { day: 'السبت',    visits: 12, revenue: 1200 },
  { day: 'الأحد',   visits: 18, revenue: 1850 },
  { day: 'الإثنين', visits: 15, revenue: 1600 },
  { day: 'الثلاثاء',visits: 22, revenue: 2400 },
  { day: 'الأربعاء',visits: 20, revenue: 2100 },
  { day: 'الخميس',  visits: 25, revenue: 2800 },
  { day: 'الجمعة',  visits: 8,  revenue: 900  },
];

const SERVICE_DIST = [
  { name: 'زيارات عيادة', value: 145, color: '#1E40AF' },
  { name: 'تحاليل',       value: 87,  color: '#10B981' },
  { name: 'أشعة',         value: 63,  color: '#8B5CF6' },
  { name: 'عمليات',       value: 24,  color: '#F59E0B' },
];

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm" dir="rtl">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value.toLocaleString('ar')}
        </p>
      ))}
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, trend, trendVal }) => (
  <motion.div whileHover={{ y: -3 }} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
          trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trendVal}
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
    <p className="text-sm font-semibold text-gray-700 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </motion.div>
);

// ─── Main Stats Screen ──────────────────────────────────────────────
const DoctorStats = () => {
  const [period, setPeriod] = useState('week');

  const periodOptions = [
    { value: 'today', label: 'اليوم' },
    { value: 'week',  label: 'هذا الأسبوع' },
    { value: 'month', label: 'هذا الشهر' },
    { value: 'year',  label: 'هذا العام' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">الإحصائيات والتقارير</h1>
          <p className="text-sm text-gray-500 mt-1">نظرة شاملة على أداء المركز</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {periodOptions.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === opt.value
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="إجمالي المرضى"    value="1,247"  sub="منذ بداية العام"  color="bg-blue-600"   trend="up"   trendVal="+12%" />
        <StatCard icon={Activity}    label="زيارات الأسبوع"   value="120"    sub="متوسط 17 يومياً"  color="bg-emerald-500" trend="up"  trendVal="+8%" />
        <StatCard icon={Scissors}    label="عمليات الشهر"     value="24"     sub="صافي ربح متوقع"   color="bg-amber-500"  trend="down" trendVal="-3%" />
        <StatCard icon={DollarSign}  label="إيرادات الأسبوع"  value="12,400" sub="دينار ليبي"       color="bg-purple-600" trend="up"  trendVal="+15%" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800">الزيارات والإيرادات</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />زيارات</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />إيرادات</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={DAILY_VISITS}>
              <defs>
                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Area type="monotone" dataKey="visits"  name="زيارات"  stroke="#1E40AF" strokeWidth={2} fill="url(#colorVisits)" dot={{ r: 3, fill: '#1E40AF' }} />
              <Area type="monotone" dataKey="revenue" name="إيرادات" stroke="#10B981" strokeWidth={2} fill="url(#colorRevenue)" dot={{ r: 3, fill: '#10B981' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-800 mb-4">توزيع الخدمات</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={SERVICE_DIST} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                dataKey="value" paddingAngle={3}>
                {SERVICE_DIST.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v}`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5">
            {SERVICE_DIST.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-600">{item.name}</span>
                </span>
                <span className="font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-5">إيرادات الأسبوع يومياً</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={DAILY_VISITS} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Bar dataKey="revenue" name="الإيرادات" fill="#1E40AF" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DoctorStats;
