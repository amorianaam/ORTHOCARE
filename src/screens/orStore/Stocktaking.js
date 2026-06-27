import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, Check, Clock, PackageOpen } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';

const Stocktaking = () => {
  const { token } = useAuthStore();
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [stocktakingItems, setStocktakingItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessRes, itemsRes] = await Promise.all([
        fetch('/api/inventory/or/stocktaking', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const sessData = await sessRes.json();
      const itemsData = await itemsRes.json();
      setSessions(Array.isArray(sessData) ? sessData : []);
      setItems(Array.isArray(itemsData) ? itemsData : []);
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const handleStartStocktaking = () => {
    if (items.length === 0) return toast.error('لا توجد أصناف في المخزن لبدء الجرد');
    const initItems = items.map(item => ({
      item_id: item.id,
      name: item.name,
      unit: item.unit,
      expected_quantity: item.quantity,
      actual_quantity: item.quantity,
      notes: ''
    }));
    setStocktakingItems(initItems);
    setIsCreating(true);
  };

  const handleQuantityChange = (id, value) => {
    setStocktakingItems(prev => prev.map(i => i.item_id === id ? { ...i, actual_quantity: value } : i));
  };

  const handleNotesChange = (id, value) => {
    setStocktakingItems(prev => prev.map(i => i.item_id === id ? { ...i, notes: value } : i));
  };

  const handleSubmit = async () => {
    const invalid = stocktakingItems.some(i => i.actual_quantity === '' || isNaN(i.actual_quantity) || i.actual_quantity < 0);
    if (invalid) return toast.error('الرجاء التأكد من إدخال كميات فعلية صحيحة لجميع الأصناف');

    if (!window.confirm('اعتماد الجرد سيؤدي إلى تحديث الأرصدة الفعلية في مخزن العمليات وتسجيل الفروقات، هل أنت متأكد؟')) return;

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/or/stocktaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: stocktakingItems })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIsCreating(false);
        fetchData();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !isCreating) {
    return <div className="animate-pulse h-64 bg-white rounded-2xl m-6"></div>;
  }

  if (isCreating) {
    return (
      <div dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">جلسة جرد جديدة (مخزن العمليات)</h1>
            <p className="text-gray-500 mt-1">قم بإدخال الكميات الفعلية الموجودة في المخزن حالياً لتحديث الأرصدة</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2">
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={18}/>}
              اعتماد وتحديث المخزون
            </button>
            <button onClick={() => setIsCreating(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 text-purple-900 border-b border-purple-100">
              <tr>
                <th className="px-6 py-4 text-right font-bold">الصنف</th>
                <th className="px-6 py-4 text-right font-bold">الوحدة</th>
                <th className="px-6 py-4 text-right font-bold">الرصيد الدفتري (النظام)</th>
                <th className="px-6 py-4 text-right font-bold">الرصيد الفعلي (المخزن)</th>
                <th className="px-6 py-4 text-right font-bold">الفروقات</th>
                <th className="px-6 py-4 text-right font-bold">ملاحظات والتسوية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stocktakingItems.map(item => {
                const diff = parseFloat(item.actual_quantity || 0) - parseFloat(item.expected_quantity || 0);
                return (
                  <tr key={item.item_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                    <td className="px-6 py-4 text-gray-500">{item.unit}</td>
                    <td className="px-6 py-4 text-gray-600">{item.expected_quantity}</td>
                    <td className="px-6 py-3">
                      <input type="number" min="0" step="0.01" value={item.actual_quantity} 
                        onChange={e => handleQuantityChange(item.item_id, e.target.value)}
                        className={`input-base w-32 font-bold text-center ${diff !== 0 ? 'border-amber-400 bg-amber-50' : ''}`} />
                    </td>
                    <td className="px-6 py-4">
                      {diff === 0 ? (
                        <span className="text-gray-400 font-bold">مطابق</span>
                      ) : diff > 0 ? (
                        <span className="text-emerald-600 font-bold">+{diff} (زيادة)</span>
                      ) : (
                        <span className="text-red-600 font-bold">{diff} (عجز)</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <input type="text" value={item.notes} onChange={e => handleNotesChange(item.item_id, e.target.value)}
                        className="input-base w-full" placeholder="سبب الفروقات إن وجدت..." />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الجرد الدوري (مخزن العمليات)</h1>
          <p className="text-gray-500 mt-1">سجل جلسات الجرد السابقة ومطابقة المخزون</p>
        </div>
        <button onClick={handleStartStocktaking} className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2">
          <Plus size={18} /> بدء جلسة جرد جديدة
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-6 py-3 text-right font-bold">رقم الجرد</th>
              <th className="px-6 py-3 text-right font-bold">التاريخ</th>
              <th className="px-6 py-3 text-right font-bold">بواسطة</th>
              <th className="px-6 py-3 text-right font-bold">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                  <ClipboardCheck size={40} className="mx-auto mb-3 opacity-20" />
                  <p>لا توجد جلسات جرد سابقة</p>
                </td>
              </tr>
            ) : (
              sessions.map(sess => (
                <tr key={sess.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-800">ORSTK-{sess.id.toString().padStart(4, '0')}</td>
                  <td className="px-6 py-4 text-gray-600 flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    {new Date(sess.completed_at || sess.created_at).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{sess.creator_name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 w-max">
                      <Check size={12} /> معتمد
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Stocktaking;
