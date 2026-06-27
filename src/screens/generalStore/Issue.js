import React, { useState, useEffect } from 'react';
import { Send, Plus, Trash2, Check, Package, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { motion } from 'framer-motion';

const IssueStock = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ destination: '', notes: '' });
  const [issuedItems, setIssuedItems] = useState([{ item_id: '', quantity: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/inventory/general/items', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setItems(Array.isArray(data) ? data.filter(i => i.quantity > 0) : [])) // Only items with stock
      .catch(() => toast.error('فشل تحميل الأصناف'));
  }, [token]);

  const handleAddItem = () => {
    setIssuedItems([...issuedItems, { item_id: '', quantity: '' }]);
  };

  const handleRemoveItem = (index) => {
    setIssuedItems(issuedItems.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const newItems = [...issuedItems];
    newItems[index][field] = value;
    setIssuedItems(newItems);
  };

  const handleSubmit = async () => {
    if (!form.destination) return toast.error('الرجاء اختيار الجهة المستفيدة');
    const validItems = issuedItems.filter(i => i.item_id && i.quantity > 0);
    if (validItems.length === 0) return toast.error('الرجاء إدخال صنف واحد على الأقل بكمية صحيحة');

    // Check quantities
    for (let it of validItems) {
      const dbItem = items.find(i => i.id == it.item_id);
      if (dbItem && parseFloat(it.quantity) > parseFloat(dbItem.quantity)) {
        return toast.error(`الكمية المطلوبة من ${dbItem.name} تتجاوز المخزون المتوفر (${dbItem.quantity})`);
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/general/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, items: validItems })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIssuedItems([{ item_id: '', quantity: '' }]);
        setForm({ destination: '', notes: '' });
        // Refresh items to get updated quantities
        const itemsRes = await fetch('/api/inventory/general/items', { headers: { Authorization: `Bearer ${token}` } });
        const itemsData = await itemsRes.json();
        setItems(Array.isArray(itemsData) ? itemsData.filter(i => i.quantity > 0) : []);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const DESTINATIONS = [
    'مخزن العمليات',
    'قسم الأشعة',
    'قسم التحاليل',
    'العيادة (الطبيب)',
    'الاستقبال',
    'تالف / أخرى'
  ];

  return (
    <div dir="rtl" className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">صرف مواد للأقسام</h1>
        <p className="text-gray-500 mt-1">توزيع وصرف المواد من المخزن العام للجهات المستفيدة</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Send size={18} className="text-amber-600"/> وجهة الصرف</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">الجهة المستفيدة <span className="text-red-500">*</span></label>
            <select value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className="input-base w-full bg-amber-50/50">
              <option value="">-- اختر الجهة المستفيدة --</option>
              {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات أو سبب الصرف</label>
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="input-base w-full" placeholder="مثال: صرف دوري لشهر كذا..." />
          </div>
        </div>
        {form.destination === 'مخزن العمليات' && (
          <div className="mt-4 p-3 bg-purple-50 text-purple-700 rounded-xl flex items-start gap-2 text-sm font-semibold">
            <Info size={16} className="mt-0.5" />
            <p>عند الصرف لمخزن العمليات، سيتم إنشاء <strong>"إشعار توريد إلكتروني"</strong> ولن تضاف للمخزن لديهم حتى يؤكد أمين مخزن العمليات استلامها.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package size={18} className="text-amber-600"/> الأصناف المنصرفة</h3>
          <button onClick={handleAddItem} className="btn-secondary flex items-center gap-2 text-sm bg-amber-50 text-amber-700 border-none hover:bg-amber-100">
            <Plus size={16} /> إضافة صنف
          </button>
        </div>

        <div className="space-y-3">
          {issuedItems.map((item, index) => {
            const selectedItem = items.find(i => i.id == item.item_id);
            const available = selectedItem ? parseFloat(selectedItem.quantity) : 0;
            const unit = selectedItem ? selectedItem.unit : '';

            return (
              <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-600 mb-1">الصنف</label>
                  <select value={item.item_id} onChange={e => handleChange(index, 'item_id', e.target.value)}
                    className="input-base w-full text-sm">
                    <option value="">-- اختر الصنف --</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (متوفر: {i.quantity})</option>)}
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-xs font-bold text-gray-600 mb-1">الكمية</label>
                  <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => handleChange(index, 'quantity', e.target.value)}
                    className="input-base w-full text-sm font-bold" placeholder="الكمية" />
                </div>

                <div className="w-32 bg-white rounded-xl border border-gray-200 p-2 text-center h-[42px] flex flex-col justify-center">
                  <span className="text-[10px] text-gray-400">الوحدة</span>
                  <span className="font-bold text-gray-700 text-sm">{unit || '-'}</span>
                </div>

                <button onClick={() => handleRemoveItem(index)} disabled={issuedItems.length === 1}
                  className="w-10 h-[42px] flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                  <Trash2 size={16} />
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-end">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary bg-amber-600 hover:bg-amber-700 flex items-center gap-2 px-8">
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={20} />}
            اعتماد وصرف
          </button>
        </div>

      </div>
    </div>
  );
};

export default IssueStock;
