import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Wallet, TrendingUp, TrendingDown,
  RotateCcw, CreditCard, Activity, Scissors, Users,
  Grid, List
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import io from 'socket.io-client';

import FinancialRecordModal from '../../components/common/FinancialRecordModal';
import EntryFeesTab from './tabs/EntryFeesTab';
import ServicesTab from './tabs/ServicesTab';
import SurgeriesTab from './tabs/SurgeriesTab';
import TodayPatientsTab from './tabs/TodayPatientsTab';

const DailyFinancialBoard = () => {
  const { token } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  const [activeTab, setActiveTab] = useState('entry_fees');
  const [viewMode, setViewModeState] = useState(() => localStorage.getItem('cashierViewMode') || 'grid');
  
  // Patient Financial Record Modal State
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const fetchPatientRecord = useCallback(async (id) => {
    setSelectedPatientId(id);
    setRecordLoading(true);
    try {
      const res = await fetch(`/api/cashier/archive/patient/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecordData(await res.json());
      } else {
        toast.error('تعذر جلب السجل المالي للمريض');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setRecordLoading(false);
    }
  }, [token]);

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    localStorage.setItem('cashierViewMode', mode);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const statsRes = await fetch('/api/cashier/stats/summary', { headers: { Authorization: `Bearer ${token}` } });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      toast.error('تعذر جلب الإحصائيات');
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
    const socket = io('/', { auth: { token } });
    socket.on('service_status_changed', () => fetchStats());
    socket.on('surgery_status_changed', () => fetchStats());
    
    const handleRealtimeUpdate = () => {
      fetchStats();
      window.dispatchEvent(new Event('cashier_update'));
    };

    socket.on('cashier:update', handleRealtimeUpdate);
    socket.on('patient:registered', handleRealtimeUpdate);
    socket.on('request:new', handleRealtimeUpdate);

    window.addEventListener('cashier_update', fetchStats);

    return () => {
      socket.disconnect();
      window.removeEventListener('cashier_update', fetchStats);
    };
  }, [fetchStats, token]);

  const TABS = [
    { id: 'entry_fees', label: 'رسوم الكشف', icon: CreditCard, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.pendingEntryFeesCount },
    { id: 'services', label: 'الخدمات الطبية', icon: Activity, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.waitingServicesCount },
    { id: 'surgeries', label: 'العمليات الجراحية', icon: Scissors, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.pendingSurgeriesCount },
    { id: 'today_patients', label: 'مراجعو اليوم', icon: Users, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.activePatientsCount },
  ];

  return (
    <div className="p-6 min-h-full flex flex-col space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-700 text-white flex items-center justify-center shadow-lg">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">لوحة العمليات اليومية</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">مراقبة حية للمركز المالي وحالة الخدمات</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'إجمالي الدخل (اليوم)', value: stats?.todayIncome || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-sky-50', border: 'border-sky-100' },
          { label: 'المرتجعات (اليوم)', value: stats?.todayRefunds || 0, icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
          { label: 'المصروفات (اليوم)', value: stats?.todayExpenses || 0, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'صافي الصندوق (اليوم)', value: stats?.todayAvailable || 0, icon: Wallet, color: 'text-sky-600', bg: 'bg-slate-50', border: 'border-indigo-100' },
        ].map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${s.border} bg-white shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${s.bg} to-transparent opacity-50 rounded-bl-[100px] -z-10`} />
            <div className="flex justify-between items-start mb-2">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <div>
              {loadingStats ? (
                 <div className="h-6 bg-gray-200 rounded animate-pulse w-20 mb-1"></div>
              ) : (
                 <p className="text-xl font-black text-gray-800">{s.value.toLocaleString('ar')} <span className="text-[10px] text-gray-400 uppercase">YER</span></p>
              )}
              <p className="text-xs font-bold text-gray-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? `${tab.activeBg} text-white shadow-md transform scale-[1.02]` 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === tab.id ? 'bg-white/20 text-white' : tab.bg + ' ' + tab.color}`}>
              <tab.icon size={14} />
            </div>
            {tab.label}
            {tab.badge > 0 && (
              <span className={`mr-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === tab.id ? 'bg-white text-gray-800' : 'bg-red-500 text-white shadow-sm animate-pulse'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-gray-50 rounded-3xl p-4 min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col"
          >
            {activeTab === 'entry_fees' && <EntryFeesTab viewMode={viewMode} setViewMode={setViewMode} onPatientClick={fetchPatientRecord} />}
            {activeTab === 'services' && <ServicesTab viewMode={viewMode} setViewMode={setViewMode} onPatientClick={fetchPatientRecord} />}
            {activeTab === 'surgeries' && <SurgeriesTab viewMode={viewMode} setViewMode={setViewMode} onPatientClick={fetchPatientRecord} />}
            {activeTab === 'today_patients' && <TodayPatientsTab viewMode={viewMode} setViewMode={setViewMode} onPatientClick={fetchPatientRecord} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Patient Financial Record Modal */}
      {selectedPatientId && (
        <FinancialRecordModal 
          recordData={recordData}
          recordLoading={recordLoading}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
};

export default DailyFinancialBoard;
