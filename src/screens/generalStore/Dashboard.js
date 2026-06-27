import React, { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { token } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/general/dashboard', {
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
      <div className="grid grid-cols-3 gap-6" dir="rtl">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}
        <div className="col-span-3 h-64 bg-white rounded-2xl animate-pulse mt-6" />
      </div>
    );
  }

  const CARDS = [
    { label: 'إجمالي الأصناف', value: stats?.totalItems || 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'أصناف تحت الحد الأدنى', value: stats?.lowStock || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'قيمة المخزون', value: `${parseFloat(stats?.totalValue || 0).toLocaleString()} ريال يمني`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
        <p className="text-gray-500 mt-1">ملخص سريع لحالة المخزن العام</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">أحدث حركات المخزون</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 text-right font-bold">الصنف</th>
                <th className="px-6 py-3 text-right font-bold">النوع</th>
                <th className="px-6 py-3 text-right font-bold">الكمية</th>
                <th className="px-6 py-3 text-right font-bold">المصدر / الوجهة</th>
                <th className="px-6 py-3 text-right font-bold">التاريخ</th>
                <th className="px-6 py-3 text-right font-bold">بواسطة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats?.recentTransactions?.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">لا توجد حركات مسجلة</td></tr>
              ) : (
                stats?.recentTransactions?.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{tx.item_name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        tx.transaction_type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {tx.transaction_type === 'in' ? <><ArrowDownToLine size={14}/> وارد</> : <><ArrowUpFromLine size={14}/> صادر</>}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold">{tx.quantity}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {tx.transaction_type === 'in' ? tx.source_entity : tx.destination_entity}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(tx.created_at).toLocaleString('ar-EG')}</td>
                    <td className="px-6 py-4 text-gray-600">{tx.user_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
