import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Search, FlaskConical,
  ChevronDown, X, Check, FolderOpen, Tag
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';

// ─── MOCK DATA (replaced by real API once DB is ready) ─────────────
const MOCK_LAB = [
  { id: 1, name: 'صورة دم كاملة CBC', category_id: 1, category_name: 'تحاليل الدم', price: 15, is_active: true },
  { id: 2, name: 'سكر صيام', category_id: 1, category_name: 'تحاليل الدم', price: 10, is_active: true },
  { id: 3, name: 'وظائف كلى', category_id: 2, category_name: 'الكيمياء الحيوية', price: 25, is_active: true },
  { id: 4, name: 'وظائف كبد', category_id: 2, category_name: 'الكيمياء الحيوية', price: 25, is_active: true },
  { id: 5, name: 'بروتين سي التفاعلي CRP', category_id: 3, category_name: 'الفحوصات الالتهابية', price: 20, is_active: true },
  { id: 6, name: 'ترسب الدم ESR', category_id: 3, category_name: 'الفحوصات الالتهابية', price: 8, is_active: true },
];
const MOCK_CATS = [
  { id: 1, name: 'تحاليل الدم' },
  { id: 2, name: 'الكيمياء الحيوية' },
  { id: 3, name: 'الفحوصات الالتهابية' },
];

// ─── Add/Edit Modal ────────────────────────────────────────────────
const TestModal = ({ test, categories, onClose, onSave }) => {
  const [form, setForm] = useState(
    test
      ? { name: test.name, category_id: test.category_id, price: test.price }
      : { name: '', category_id: categories[0]?.id || '', price: '' }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-l from-blue-50 to-white">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} className="text-blue-600" />
            <h3 className="font-bold text-gray-800">{test ? 'تعديل تحليل' : 'إضافة تحليل جديد'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">اسم التحليل *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="input-base" placeholder="مثال: صورة دم كاملة CBC" />
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">السعر (ريال يمني) *</label>
            <input type="number" min="0" value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              className="input-base" placeholder="0.00" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => onSave(form)} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Check size={15} /> {test ? 'حفظ التعديلات' : 'إضافة التحليل'}
            </button>
            <button onClick={onClose} className="btn-secondary px-5">إلغاء</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Catalog Screen ───────────────────────────────────────────
const LabCatalog = () => {
  const { token } = useAuthStore();
  const [tests, setTests]       = useState(MOCK_LAB);
  const [categories, setCategories] = useState(MOCK_CATS);
  const [query, setQuery]       = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [modal, setModal]       = useState(null); // null | 'add' | test_object
  const [loading, setLoading]   = useState(false);

  const filtered = tests.filter(t => {
    const matchQ   = !query || t.name.toLowerCase().includes(query.toLowerCase());
    const matchCat = filterCat === 'all' || String(t.category_id) === filterCat;
    return matchQ && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, t) => {
    const cat = t.category_name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const handleSave = (form) => {
    if (modal === 'add') {
      const newTest = {
        id: Date.now(), ...form,
        category_name: categories.find(c => String(c.id) === String(form.category_id))?.name || '',
        is_active: true,
      };
      setTests(prev => [newTest, ...prev]);
      toast.success('تم إضافة التحليل بنجاح');
    } else {
      setTests(prev => prev.map(t => t.id === modal.id
        ? { ...t, ...form, category_name: categories.find(c => String(c.id) === String(form.category_id))?.name || t.category_name }
        : t
      ));
      toast.success('تم تعديل التحليل بنجاح');
    }
    setModal(null);
  };

  const handleToggle = (id) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">كتالوج التحاليل المخبرية</h1>
          <p className="text-sm text-gray-500 mt-1">{tests.length} تحليل مسجل</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> إضافة تحليل
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            className="input-base pr-9 text-sm" placeholder="ابحث عن تحليل..." />
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

      {/* Grouped Tests */}
      <div className="space-y-4">
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <FlaskConical size={36} className="mx-auto mb-3 opacity-20" />
            <p>لا توجد نتائج مطابقة</p>
          </div>
        ) : Object.entries(grouped).map(([cat, items]) => (
          <motion.div key={cat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
          >
            {/* Category Header */}
            <div className="flex items-center gap-2.5 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <FolderOpen size={15} className="text-blue-500" />
              <span className="font-bold text-gray-700 text-sm">{cat}</span>
              <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>

            {/* Tests Table */}
            <table className="w-full text-sm">
              <tbody>
                {items.map((test, i) => (
                  <motion.tr key={test.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`border-b border-gray-50 last:border-0 transition-colors ${
                      !test.is_active ? 'opacity-50' : 'hover:bg-blue-50/40'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-gray-400 flex-shrink-0" />
                        <span className={`font-semibold ${test.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {test.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-left">
                      <span className="font-bold text-blue-700 text-sm">{test.price} <span className="font-normal text-gray-500 text-xs">ريال يمني</span></span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        test.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {test.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setModal(test)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleToggle(test.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            test.is_active
                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}>
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

      {/* Modal */}
      <AnimatePresence>
        {modal !== null && (
          <TestModal
            test={modal === 'add' ? null : modal}
            categories={categories}
            onClose={() => setModal(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LabCatalog;
