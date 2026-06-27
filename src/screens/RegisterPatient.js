import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Save, RefreshCcw, UserCheck,
  ChevronDown, Heart, Pill, AlertTriangle, ChevronUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';

const EMPTY_FORM = {
  fullName: '', age: '', gender: 'male', phone: '',
  entity: 'clinic',
};

const RegisterPatient = () => {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const handleChange = (e) => set(e.target.name, e.target.value);

  const handleReset = () => {
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error('الاسم الكامل مطلوب');
    if (!form.age || isNaN(form.age) || form.age < 0 || form.age > 150)
      return toast.error('يرجى إدخال عمر صحيح');

    setLoading(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✓ تم تسجيل المريض "${form.fullName}" — رقم الزيارة: ${data.visitNumber}`);
        handleReset();
      } else {
        toast.error(data.message || 'حدث خطأ أثناء التسجيل');
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم — تأكد من تشغيل XAMPP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      {/* ── Page Title ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تسجيل مريض جديد</h1>
          <p className="text-sm text-gray-500 mt-1">أدخل البيانات الأساسية للمريض</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 px-4 py-2 rounded-xl border border-teal-200">
          <UserCheck size={16} />
          <span className="font-semibold">مريض جديد</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Card 1: Basic Info ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4"
        >
          <div className="flex items-center gap-2 text-teal-700 mb-5 pb-3 border-b border-gray-100">
            <User size={16} />
            <span className="font-bold text-sm">البيانات الأساسية</span>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                name="fullName" value={form.fullName} onChange={handleChange}
                required placeholder="أدخل الاسم الرباعي"
                className="input-base"
              />
            </div>

            {/* Age + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  العمر <span className="text-red-500">*</span>
                </label>
                <input
                  name="age" value={form.age} onChange={handleChange}
                  type="number" min="0" max="150" required
                  placeholder="بالسنوات"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">الجنس <span className="text-red-500">*</span></label>
                <div className="flex gap-2 h-[44px]">
                  {[{ v: 'male', l: '♂ ذكر' }, { v: 'female', l: '♀ أنثى' }].map(opt => (
                    <label key={opt.v} className={`flex-1 flex items-center justify-center rounded-xl border-2 cursor-pointer text-sm font-semibold transition-all ${
                      form.gender === opt.v
                        ? opt.v === 'male' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="gender" value={opt.v}
                        checked={form.gender === opt.v} onChange={handleChange} className="hidden" />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                رقم الهاتف <span className="text-xs text-gray-400 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  name="phone" value={form.phone} onChange={handleChange}
                  type="tel" placeholder="09XXXXXXXX"
                  className="input-base pr-9"
                />
              </div>
            </div>

            {/* Entity */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">جهة التسجيل <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                {[{ v: 'clinic', l: '🏥 العيادة' }, { v: 'center', l: '🏗️ المركز' }].map(opt => (
                  <label key={opt.v} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer font-semibold text-sm transition-all ${
                    form.entity === opt.v
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="entity" value={opt.v}
                      checked={form.entity === opt.v} onChange={handleChange} className="hidden" />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </motion.div>


        {/* ── Action Buttons ── */}
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 px-8">
            {loading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : <Save size={16} />}
            {loading ? 'جاري التسجيل...' : 'تسجيل المريض'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterPatient;
