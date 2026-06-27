import React, { useState, useEffect, useCallback } from 'react';
import { PackageOpen, AlertTriangle, TrendingUp, Bell } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { token } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/or/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      toast.error('فشل تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-6" dir="rtl">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const CARDS = [
    { label: 'إجمالي الأصناف', value: stats?.totalItems || 0, icon: PackageOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'أصناف تحت الحد الأدنى', value: stats?.lowStock || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'شحنات معلقة من المخزن', value: stats?.pendingTransfers || 0, icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'قيمة المخزون', value: `${parseFloat(stats?.totalValue || 0).toLocaleString()} ريال يمني`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
        <p className="text-gray-500 mt-1">ملخص سريع لحالة مخزن العمليات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
