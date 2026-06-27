import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Download, Package, Inbox, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const ReceiveStock = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('transfers'); // 'transfers' | 'direct'
  
  // Transfers state
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(true);
  
  // Direct receive state
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ supplier: '', notes: '' });
  const [receivedItems, setReceivedItems] = useState([{ item_id: '', quantity: '', unit_price: '' }]);
  const [saving, setSaving] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoadingTransfers(true);
    try {
      const res = await fetch('/api/inventory/or/transfers/pending', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTransfers(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل الشحنات المعلقة'); }
    finally { setLoadingTransfers(false); }
  }, [token]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل الأصناف'); }
  }, [token]);

  useEffect(() => {
    fetchTransfers();
    fetchItems();
  }, [fetchTransfers, fetchItems]);

  const handleConfirmTransfer = async (transferId) => {
    if (!window.confirm('هل أنت متأكد من استلام هذه الشحنة وإضافتها لمخزون العمليات؟')) return;
    try {
      const res = await fetch(`/api/inventory/or/transfers/${transferId}/receive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchTransfers();
        fetchItems(); // refresh items in case new items were created
      } else toast.error(data.message);
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const handleAddDirectItem = () => setReceivedItems([...receivedItems, { item_id: '', quantity: '', unit_price: '' }]);
  const handleRemoveDirectItem = (index) => setReceivedItems(receivedItems.filter((_, i) => i !== index));
  const handleDirectChange = (index, field, value) => {
    const newItems = [...receivedItems];
    newItems[index][field] = value;
    setReceivedItems(newItems);
  };

  const handleDirectSubmit = async () => {
    const validItems = receivedItems.filter(i => i.item_id && i.quantity > 0 && i.unit_price >= 0);
    if (validItems.length === 0) return toast.error('الرجاء إدخال صنف واحد على الأقل بكمية صحيحة');

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/or/receive-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, items: validItems })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setReceivedItems([{ item_id: '', quantity: '', unit_price: '' }]);
        setForm({ supplier: '', notes: '' });
      } else toast.error(data.message);
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setSaving(false); }
  };

  return (
    <div dir="rtl" className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">استلام بضائع (مخزن العمليات)</h1>
        <p className="text-gray-500 mt-1">تأكيد شحنات المخزن العام أو استلام بضائع مباشرة من مورد</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${
            activeTab === 'transfers' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}>
          <Inbox size={18} /> شحنات المخزن العام ({transfers.length})
        </button>
        <button onClick={() => setActiveTab('direct')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${
            activeTab === 'direct' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}>
          <Download size={18} /> استلام مباشر (مورد خارجي)
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'transfers' ? (
          <motion.div key="transfers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {loadingTransfers ? (
              <div className="h-32 bg-white rounded-2xl animate-pulse"></div>
            ) : transfers.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
                <Inbox size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold text-gray-600 mb-1">لا توجد شحنات معلقة</h3>
                <p>لم يقم المخزن العام بإرسال أي بضائع جديدة بانتظار التأكيد.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transfers.map(tr => (
                  <div key={tr.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                        <Package size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">{tr.item_name}</h4>
                        <p className="text-sm text-gray-500">الكمية المرسلة: <span className="font-bold text-gray-800">{tr.sent_quantity} {tr.unit}</span></p>
                        <p className="text-xs text-gray-400 mt-1">بواسطة: {tr.sender_name} · {new Date(tr.sent_at).toLocaleString('ar-EG')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 w-full md:w-auto">
                        <AlertCircle size={14} /> بانتظار التأكيد
                      </div>
                      <button onClick={() => handleConfirmTransfer(tr.id)} className="btn-primary bg-purple-600 hover:bg-purple-700 whitespace-nowrap">
                        <Check size={16} /> تأكيد الاستلام
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="direct" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Download size={18} className="text-purple-600"/> بيانات المورد المباشر</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">اسم المورد (اختياري)</label>
                  <input type="text" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}
                    className="input-base w-full" placeholder="مثال: صيدلية المركز..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات الفاتورة</label>
                  <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    className="input-base w-full" placeholder="رقم الفاتورة، تفاصيل..." />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Package size={18} className="text-purple-600"/> الأصناف المستلمة</h3>
                <button onClick={handleAddDirectItem} className="btn-secondary flex items-center gap-2 text-sm bg-purple-50 text-purple-700 border-none hover:bg-purple-100">
                  <Plus size={16} /> إضافة صنف
                </button>
              </div>

              <div className="space-y-3">
                {receivedItems.map((item, index) => (
                  <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-end gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-600 mb-1">الصنف</label>
                      <select value={item.item_id} onChange={e => handleDirectChange(index, 'item_id', e.target.value)}
                        className="input-base w-full text-sm">
                        <option value="">-- اختر الصنف --</option>
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>

                    <div className="w-32">
                      <label className="block text-xs font-bold text-gray-600 mb-1">الكمية</label>
                      <input type="number" min="1" value={item.quantity} onChange={e => handleDirectChange(index, 'quantity', e.target.value)}
                        className="input-base w-full text-sm font-bold" placeholder="الكمية" />
                    </div>

                    <div className="w-32">
                      <label className="block text-xs font-bold text-gray-600 mb-1">سعر الوحدة (التكلفة)</label>
                      <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => handleDirectChange(index, 'unit_price', e.target.value)}
                        className="input-base w-full text-sm font-bold" placeholder="السعر" />
                    </div>

                    <div className="w-32 bg-white rounded-xl border border-gray-200 p-2 text-center h-[42px] flex flex-col justify-center">
                      <span className="text-[10px] text-gray-400">الإجمالي</span>
                      <span className="font-bold text-purple-700 text-sm">
                        {((parseFloat(item.quantity||0) * parseFloat(item.unit_price||0))).toFixed(2)}
                      </span>
                    </div>

                    <button onClick={() => handleRemoveDirectItem(index)} disabled={receivedItems.length === 1}
                      className="w-10 h-[42px] flex items-center justify-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-end">
                <button onClick={handleDirectSubmit} disabled={saving} className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2 px-8">
                  {saving ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"/> : <Check size={20} />}
                  حفظ الاستلام المباشر
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReceiveStock;
