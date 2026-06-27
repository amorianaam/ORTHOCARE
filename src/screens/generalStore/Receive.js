import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Download, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { motion } from 'framer-motion';

const ReceiveStock = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ supplier: '', invoice_date: new Date().toISOString().split('T')[0] });
  const [receivedItems, setReceivedItems] = useState([{ item_id: '', quantity: '', unit_price: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/inventory/general/items', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => toast.error('فشل تحميل الأصناف'));
  }, [token]);

  const handleAddItem = () => {
    setReceivedItems([...receivedItems, { item_id: '', quantity: '', unit_price: '' }]);
  };

  const handleRemoveItem = (index) => {
    setReceivedItems(receivedItems.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const newItems = [...receivedItems];
    newItems[index][field] = value;
    setReceivedItems(newItems);
  };

  const handleSubmit = async () => {
    const validItems = receivedItems.filter(i => i.item_id && i.quantity > 0 && i.unit_price >= 0);
    if (validItems.length === 0) return toast.error('الرجاء إدخال صنف واحد على الأقل بكمية صحيحة');

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/general/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, items: validItems })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setReceivedItems([{ item_id: '', quantity: '', unit_price: '' }]);
        setForm({ supplier: '', invoice_date: new Date().toISOString().split('T')[0] });
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = receivedItems.reduce((acc, curr) => {
    return acc + (parseFloat(curr.quantity || 0) * parseFloat(curr.unit_price || 0));
  }, 0);

  return (
    <div dir="rtl" className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">استلام وارد جديد</h1>
        <p className="text-gray-500 mt-1">إضافة فواتير الموردين للمخزون العام</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Download size={18} className="text-blue-600"/> بيانات الفاتورة / المورد</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم المورد (اختياري)</label>
            <input type="text" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}
              className="input-base w-full" placeholder="مثال: شركة الأدوية الحديثة" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الفاتورة</label>
            <input type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})}
              className="input-base w-full" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package size={18} className="text-blue-600"/> الأصناف المستلمة</h3>
          <button onClick={handleAddItem} className="btn-secondary flex items-center gap-2 text-sm bg-blue-50 text-blue-700 border-none hover:bg-blue-100">
            <Plus size={16} /> إضافة صنف
          </button>
        </div>

        <div className="space-y-3">
          {receivedItems.map((item, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
              
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">الصنف</label>
                <select value={item.item_id} onChange={e => handleChange(index, 'item_id', e.target.value)}
                  className="input-base w-full text-sm">
                  <option value="">-- اختر الصنف --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div className="w-32">
                <label className="block text-xs font-bold text-gray-600 mb-1">الكمية</label>
                <input type="number" min="1" value={item.quantity} onChange={e => handleChange(index, 'quantity', e.target.value)}
                  className="input-base w-full text-sm font-bold" placeholder="الكمية" />
              </div>

              <div className="w-32">
                <label className="block text-xs font-bold text-gray-600 mb-1">سعر الوحدة</label>
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => handleChange(index, 'unit_price', e.target.value)}
                  className="input-base w-full text-sm font-bold" placeholder="السعر" />
              </div>

              <div className="w-32 bg-white rounded-xl border border-gray-200 p-2 text-center h-[42px] flex flex-col justify-center">
                <span className="text-[10px] text-gray-400">الإجمالي</span>
                <span className="font-bold text-blue-700 text-sm">
                  {((parseFloat(item.quantity||0) * parseFloat(item.unit_price||0))).toFixed(2)}
                </span>
              </div>

              <button onClick={() => handleRemoveItem(index)} disabled={receivedItems.length === 1}
                className="w-10 h-[42px] flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between bg-blue-50/50 p-4 rounded-xl">
          <div>
            <p className="text-sm font-bold text-gray-600">إجمالي قيمة الفاتورة</p>
            <p className="text-3xl font-bold text-blue-700">{totalAmount.toLocaleString()} <span className="text-sm">ريال يمني</span></p>
          </div>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary bg-blue-600 hover:bg-blue-700 flex items-center gap-2 px-8">
            {saving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={20} />}
            حفظ واستلام
          </button>
        </div>

      </div>
    </div>
  );
};

export default ReceiveStock;
