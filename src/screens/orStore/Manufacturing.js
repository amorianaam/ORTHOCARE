import React, { useState, useEffect } from 'react';
import { Beaker, ArrowLeftRight, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';

const Manufacturing = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    raw_item_id: '',
    raw_quantity: '',
    produced_item_id: '',
    produced_quantity: '',
    waste_percentage: 0,
    issue_price: ''
  });

  useEffect(() => {
    fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => toast.error('فشل تحميل الأصناف'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.raw_item_id === form.produced_item_id) {
      return toast.error('لا يمكن أن يكون الصنف الخام هو نفسه الصنف المنتج');
    }

    const rawItem = items.find(i => i.id == form.raw_item_id);
    if (rawItem && parseFloat(form.raw_quantity) > parseFloat(rawItem.quantity)) {
      return toast.error(`الكمية المطلوبة من ${rawItem.name} تتجاوز المخزون المتوفر (${rawItem.quantity})`);
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/or/manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setForm({ raw_item_id: '', raw_quantity: '', produced_item_id: '', produced_quantity: '', waste_percentage: 0, issue_price: '' });
        // Refresh items
        const itemsRes = await fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } });
        const itemsData = await itemsRes.json();
        setItems(Array.isArray(itemsData) ? itemsData : []);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const rawMaterials = items.filter(i => i.is_raw_material && i.quantity > 0);
  const rawItem = items.find(i => i.id == form.raw_item_id);
  
  // Calculate preview cost
  let previewCost = 0;
  if (rawItem && form.raw_quantity && form.produced_quantity) {
    previewCost = (parseFloat(rawItem.cost_price) * parseFloat(form.raw_quantity)) / parseFloat(form.produced_quantity);
  }

  return (
    <div dir="rtl" className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">التصنيع والتحويل الداخلي</h1>
        <p className="text-gray-500 mt-1">تحويل المواد الخام أو الكميات الكبيرة إلى وحدات أصغر تستخدم في العمليات</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-purple-50/50 p-6 border-b border-purple-100 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-purple-600 shadow-sm">
            <Beaker size={24} />
          </div>
          <div>
            <h2 className="font-bold text-purple-900 text-lg">معالج التحويل</h2>
            <p className="text-sm text-purple-700/80 mt-1">مثال: تحويل "لفة شاش" إلى 100 "قطعة شاش صغيرة" مع حساب التكلفة التلقائي.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
            
            {/* Source */}
            <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 relative">
              <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm border-2 border-white">1</span>
              <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">المادة الخام (المصدر)</h3>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اختيار الصنف</label>
                <select required value={form.raw_item_id} onChange={e => setForm({...form, raw_item_id: e.target.value})}
                  className="input-base w-full">
                  <option value="">-- اختر المادة الخام --</option>
                  {rawMaterials.map(i => <option key={i.id} value={i.id}>{i.name} (متوفر: {i.quantity} {i.unit})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية المستهلكة من المصدر</label>
                <input required type="number" min="0.01" step="0.01" value={form.raw_quantity} onChange={e => setForm({...form, raw_quantity: e.target.value})}
                  className="input-base w-full font-bold" placeholder="مثال: 1" />
              </div>

              {rawItem && (
                <div className="bg-white p-3 rounded-xl border border-amber-100 text-sm">
                  <p className="text-gray-500">التكلفة الحالية للوحدة: <strong className="text-gray-900">{rawItem.cost_price} ريال يمني</strong></p>
                  <p className="text-gray-500">التكلفة الإجمالية للمستهلك: <strong className="text-amber-700">{(parseFloat(rawItem.cost_price) * parseFloat(form.raw_quantity || 0)).toFixed(2)} ريال يمني</strong></p>
                </div>
              )}
            </div>

            {/* Icon */}
            <div className="flex justify-center hidden md:flex">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center border-4 border-white shadow-sm">
                <ArrowLeftRight size={20} />
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-4 bg-purple-50/30 p-6 rounded-2xl border border-purple-100 relative">
              <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm border-2 border-white">2</span>
              <h3 className="font-bold text-purple-900 border-b border-purple-100 pb-2 mb-4">المنتج النهائي (الناتج)</h3>

              <div>
                <label className="block text-sm font-bold text-purple-900 mb-1">اختيار الصنف</label>
                <select required value={form.produced_item_id} onChange={e => setForm({...form, produced_item_id: e.target.value})}
                  className="input-base w-full bg-white">
                  <option value="">-- اختر الصنف الناتج --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-purple-900 mb-1">الكمية المنتجة (الصافية)</label>
                <input required type="number" min="0.01" step="0.01" value={form.produced_quantity} onChange={e => setForm({...form, produced_quantity: e.target.value})}
                  className="input-base w-full bg-white font-bold" placeholder="مثال: 100" />
              </div>

              <div>
                <label className="block text-sm font-bold text-purple-900 mb-1">سعر البيع/الصرف للوحدة المنتجة (اختياري)</label>
                <input type="number" min="0" step="0.01" value={form.issue_price} onChange={e => setForm({...form, issue_price: e.target.value})}
                  className="input-base w-full bg-white" placeholder={`افتراضي: تكلفة الإنتاج`} />
              </div>
            </div>

          </div>

          {/* Preview & Action */}
          <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 flex items-center gap-3 w-full p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100">
              <AlertCircle size={20} className="flex-shrink-0" />
              <div className="text-sm font-semibold">
                بناءً على المعطيات، ستكون تكلفة الوحدة الواحدة للمنتج النهائي هي: <span className="text-xl font-bold mr-2 bg-white px-2 py-1 rounded text-emerald-700">{previewCost.toFixed(2)} ريال يمني</span>
              </div>
            </div>

            <button type="submit" disabled={saving || !form.raw_item_id || !form.produced_item_id} 
              className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2 px-10 w-full md:w-auto h-[54px] text-lg">
              {saving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={20} />}
              تنفيذ التحويل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Manufacturing;
