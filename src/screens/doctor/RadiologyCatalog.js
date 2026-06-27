import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Search, X, Check, FolderOpen, Tag, Radiation, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

const MOCK_RAD = [
  { id: 1, name: 'أشعة سينية للركبة', category_id: 1, category_name: 'الأشعة السينية', price_with_film: 30, price_without_film: 20, is_active: true },
  { id: 2, name: 'أشعة سينية للعمود الفقري', category_id: 1, category_name: 'الأشعة السينية', price_with_film: 35, price_without_film: 25, is_active: true },
  { id: 3, name: 'رنين مغناطيسي للركبة', category_id: 2, category_name: 'الرنين المغناطيسي', price_with_film: 150, price_without_film: 120, is_active: true },
  { id: 4, name: 'رنين مغناطيسي للكتف', category_id: 2, category_name: 'الرنين المغناطيسي', price_with_film: 150, price_without_film: 120, is_active: true },
  { id: 5, name: 'CT الركبة', category_id: 3, category_name: 'الأشعة المقطعية CT', price_with_film: 200, price_without_film: 170, is_active: true },
];
const MOCK_CATS = [
  { id: 1, name: 'الأشعة السينية' },
  { id: 2, name: 'الرنين المغناطيسي' },
  { id: 3, name: 'الأشعة المقطعية CT' },
];

const RadModal = ({ test, categories, onClose, onSave }) => {
  const [form, setForm] = useState(
    test
      ? { name: test.name, category_id: test.category_id, price_with_film: test.price_with_film, price_without_film: test.price_without_film }
      : { name: '', category_id: categories[0]?.id || '', price_with_film: '', price_without_film: '' }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-purple-50 to-white">
          <div className="flex items-center gap-2">
            <Radiation size={18} className="text-purple-600" />
            <h3 className="font-bold text-gray-800">{test ? 'تعديل أشعة' : 'إضافة أشعة جديدة'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">نوع الأشعة *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="input-base" placeholder="مثال: رنين مغناطيسي للركبة" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">التصنيف *</label>
            <div className="relative">
              <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                className="input-base appearance-none">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">السعر مع فيلم *</label>
              <input type="number" min="0" value={form.price_with_film}
                onChange={e => setForm(p => ({ ...p, price_with_film: e.target.value }))}
                className="input-base" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">السعر بدون فيلم *</label>
              <input type="number" min="0" value={form.price_without_film}
                onChange={e => setForm(p => ({ ...p, price_without_film: e.target.value }))}
                className="input-base" placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
              <Check size={15} /> {test ? 'حفظ التعديلات' : 'إضافة الأشعة'}
            </button>
            <button onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const RadiologyCatalog = () => {
  const [tests, setTests]   = useState(MOCK_RAD);
  const [categories]        = useState(MOCK_CATS);
  const [query, setQuery]   = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [modal, setModal]   = useState(null);

  const filtered = tests.filter(t => {
    const matchQ   = !query || t.name.toLowerCase().includes(query.toLowerCase());
    const matchCat = filterCat === 'all' || String(t.category_id) === filterCat;
    return matchQ && matchCat;
  });

  const grouped = filtered.reduce((acc, t) => {
    if (!acc[t.category_name]) acc[t.category_name] = [];
    acc[t.category_name].push(t);
    return acc;
  }, {});

  const handleSave = (form) => {
    const catName = categories.find(c => String(c.id) === String(form.category_id))?.name || '';
    if (modal === 'add') {
      setTests(prev => [{ id: Date.now(), ...form, category_name: catName, is_active: true }, ...prev]);
      toast.success('تم إضافة الأشعة بنجاح');
    } else {
      setTests(prev => prev.map(t => t.id === modal.id ? { ...t, ...form, category_name: catName } : t));
      toast.success('تم تعديل الأشعة بنجاح');
    }
    setModal(null);
  };

  const handleToggle = (id) =>
    setTests(prev => prev.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">كتالوج التصوير الشعاعي</h1>
          <p className="text-sm text-gray-500 mt-1">{tests.length} فحص مسجل</p>
        </div>
        <button onClick={() => setModal('add')} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors">
          <Plus size={15} /> إضافة أشعة
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            className="input-base pr-9 text-sm" placeholder="ابحث عن نوع أشعة..." />
        </div>
        <div className="relative">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="input-base appearance-none pr-4 pl-8 text-sm min-w-[160px]">
            <option value="all">كل التصنيفات</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, items]) => (
          <motion.div key={cat} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-5 py-3 bg-purple-50/50 border-b border-gray-100">
              <FolderOpen size={15} className="text-purple-500" />
              <span className="font-bold text-gray-700 text-sm">{cat}</span>
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-right px-5 py-2 text-xs text-gray-400 font-semibold">الفحص</th>
                  <th className="text-center px-5 py-2 text-xs text-gray-400 font-semibold">مع فيلم</th>
                  <th className="text-center px-5 py-2 text-xs text-gray-400 font-semibold">بدون فيلم</th>
                  <th className="text-right px-5 py-2 text-xs text-gray-400 font-semibold">الحالة</th>
                  <th className="px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((test, i) => (
                  <motion.tr key={test.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-gray-50 last:border-0 transition-colors ${!test.is_active ? 'opacity-50' : 'hover:bg-purple-50/30'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-gray-400" />
                        <span className={`font-semibold ${!test.is_active ? 'line-through text-gray-400' : 'text-gray-800'}`}>{test.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-bold text-purple-700">{test.price_with_film} <span className="font-normal text-gray-400 text-xs">ريال يمني</span></span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-bold text-gray-600">{test.price_without_film} <span className="font-normal text-gray-400 text-xs">ريال يمني</span></span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${test.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {test.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setModal(test)} className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => handleToggle(test.id)} className={`p-1.5 rounded-lg transition-colors ${test.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                          {test.is_active ? <X size={13} /> : <Check size={13} />}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {modal !== null && (
          <RadModal test={modal === 'add' ? null : modal} categories={categories}
            onClose={() => setModal(null)} onSave={handleSave} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadiologyCatalog;
