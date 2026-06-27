import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, AlertCircle, Scissors, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';

const ItemModal = ({ item, onClose, onSaved, token }) => {
  const [form, setForm] = useState(item || {
    name: '', description: '', unit: 'قطعة', min_quantity: 10, cost_price: 0, issue_price: 0, expiry_date: '', is_raw_material: false
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = item 
        ? `/api/inventory/or/items/${item.id}`
        : `/api/inventory/or/items`;
      const method = item ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        onSaved();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" dir="rtl">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-purple-50 border-b border-purple-100">
          <h3 className="font-bold text-purple-900">{item ? 'تعديل الصنف' : 'إضافة صنف جديد'}</h3>
          <button onClick={onClose} className="text-purple-400 hover:text-purple-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">اسم الصنف</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="input-base w-full" placeholder="اسم الصنف (علمي / تجاري)" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">الوصف</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="input-base w-full" placeholder="وصف إضافي" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الوحدة</label>
              <input required value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                className="input-base w-full" placeholder="علبة، قطعة، لفة..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">الحد الأدنى للتنبيه</label>
              <input required type="number" min="0" value={form.min_quantity} onChange={e => setForm({...form, min_quantity: e.target.value})}
                className="input-base w-full" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">التكلفة (شراء)</label>
              <input required type="number" step="0.01" min="0" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})}
                className="input-base w-full" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">سعر الصرف (للعمليات)</label>
              <input required type="number" step="0.01" min="0" value={form.issue_price} onChange={e => setForm({...form, issue_price: e.target.value})}
                className="input-base w-full" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الانتهاء</label>
              <input type="date" value={form.expiry_date ? form.expiry_date.split('T')[0] : ''} onChange={e => setForm({...form, expiry_date: e.target.value})}
                className="input-base w-full" />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="is_raw" checked={form.is_raw_material} onChange={e => setForm({...form, is_raw_material: e.target.checked})}
                className="w-4 h-4 text-purple-600 rounded border-gray-300" />
              <label htmlFor="is_raw" className="text-sm font-bold text-gray-700">مادة خام للتصنيع</label>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn-primary flex-1 bg-purple-600 hover:bg-purple-700 flex justify-center items-center gap-2">
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={16}/>}
              حفظ
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Items = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ isOpen: false, item: null });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/or/items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error('فشل تحميل الأصناف');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter(i => 
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">أصناف العمليات</h1>
          <p className="text-gray-500 mt-1">إدارة المستلزمات الطبية لغرفة العمليات</p>
        </div>
        <button onClick={() => setModal({ isOpen: true, item: null })}
          className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2">
          <Plus size={18} /> صنف جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن صنف..." className="input-base pr-10 w-full bg-white" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 text-right font-bold">الصنف</th>
                <th className="px-6 py-3 text-right font-bold">النوع</th>
                <th className="px-6 py-3 text-right font-bold">الرصيد الحالي</th>
                <th className="px-6 py-3 text-right font-bold">التكلفة</th>
                <th className="px-6 py-3 text-right font-bold">سعر البيع (الصرف)</th>
                <th className="px-6 py-3 text-right font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}><td colSpan="6" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    <Scissors size={40} className="mx-auto mb-3 opacity-20" />
                    <p>لا توجد أصناف مسجلة</p>
                  </td>
                </tr>
              ) : filtered.map(item => {
                const isLow = parseFloat(item.quantity) <= parseFloat(item.min_quantity);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.unit} {item.description ? ` - ${item.description}` : ''}</p>
                    </td>
                    <td className="px-6 py-4">
                      {item.is_raw_material ? 
                        <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg">مادة خام</span> : 
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg">جاهز</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold ${
                        isLow ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.quantity}
                        {isLow && <AlertCircle size={14} />}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{item.cost_price} ريال يمني</td>
                    <td className="px-6 py-4 font-bold text-purple-700">{item.issue_price} ريال يمني</td>
                    <td className="px-6 py-4">
                      <button onClick={() => setModal({ isOpen: true, item })}
                        className="p-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {modal.isOpen && (
          <ItemModal item={modal.item} token={token} onClose={() => setModal({ isOpen: false, item: null })}
            onSaved={() => { setModal({ isOpen: false, item: null }); fetchItems(); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Items;
