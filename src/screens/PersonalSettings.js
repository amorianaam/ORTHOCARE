import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Eye, EyeOff, Save, CheckCircle,
  Shield, Bell, Info, Sun, Moon
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';

// ── Section Card ────────────────────────────────────────────────────
const SectionCard = ({ icon: Icon, title, color, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4"
  >
    <div className={`flex items-center gap-3 px-6 py-4 border-b border-gray-100 ${color}`}>
      <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center">
        <Icon size={17} />
      </div>
      <h3 className="font-bold text-sm">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </motion.div>
);

// ── Password Field ─────────────────────────────────────────────────
const PasswordField = ({ label, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="input-base pl-10"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────
const PersonalSettings = () => {
  const { user, token, login } = useAuthStore();

  // Profile form
  const [profile, setProfile] = useState({ fullName: user?.fullName || user?.full_name || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pass, setPass] = useState({ current: '', new: '', confirm: '' });
  const [savingPass, setSavingPass] = useState(false);

  // Theme & Security
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [securityModalText, setSecurityModalText] = useState('');

  // Notifications
  const [notif, setNotif] = useState({ queueAlerts: true, newPatients: true });

  const toggleTheme = (selectedTheme) => {
    setTheme(selectedTheme);
    localStorage.setItem('theme', selectedTheme);
    if (selectedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const ROLE_LABELS = {
    doctor: 'طبيب', secretary: 'سكرتير', cashier: 'محاسب',
    lab: 'مختبر', radiology: 'أشعة', surgery_coordinator: 'منسق عمليات',
    or_store: 'مخزن العمليات', general_store: 'المخزن العام', auditor: 'مدير التقارير',
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.fullName.trim()) return toast.error('الاسم مطلوب');
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: profile.fullName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم تحديث بيانات الملف الشخصي');
        // Update local store
        login({ ...user, fullName: profile.fullName }, token);
      } else {
        toast.error(data.message || 'فشل التحديث');
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pass.current) return toast.error('أدخل كلمة المرور الحالية');
    if (pass.new.length < 6) return toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    if (pass.new !== pass.confirm) return toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين');
    setSavingPass(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pass.current, newPassword: pass.new }),
      });
      const data = await res.json();
      if (res.ok) {
        setSecurityModalText(data.message || 'تم تقديم طلب تعديل كلمة المرور الخاصة بك بنجاح إلى إدارة النظام للمراجعة والاعتماد.');
        setPass({ current: '', new: '', confirm: '' });
      } else {
        toast.error(data.message || 'فشل تغيير كلمة المرور');
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات الشخصية</h1>
        <p className="text-sm text-gray-500 mt-1">إدارة بيانات حسابك الشخصي</p>
      </div>

      {/* ── Account Info Card ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-2xl shadow-md p-5 mb-5 text-white flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold shadow-inner">
          {(user?.fullName || user?.full_name || '?').charAt(0)}
        </div>
        <div>
          <p className="font-bold text-lg leading-none">{user?.fullName || user?.full_name}</p>
          <p className="text-blue-200 text-sm mt-1">{user?.username}</p>
          <span className="inline-block mt-2 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
        </div>
      </motion.div>

      {/* ── Profile Section ── */}
      <SectionCard icon={User} title="بيانات الملف الشخصي" color="bg-blue-50 text-blue-700">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل</label>
            <input value={profile.fullName}
              onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
              className="input-base" placeholder="الاسم الكامل" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المستخدم</label>
            <input value={user?.username || ''} disabled
              className="input-base bg-gray-50 text-gray-400 cursor-not-allowed" dir="ltr" />
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Info size={11} /> لا يمكن تغيير اسم المستخدم
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الدور الوظيفي</label>
            <input value={ROLE_LABELS[user?.role] || user?.role || ''} disabled
              className="input-base bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <button type="submit" disabled={savingProfile}
            className="btn-primary flex items-center gap-2 text-sm">
            {savingProfile
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <Save size={14} />}
            {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </form>
      </SectionCard>

      {/* ── Change Password Section ── */}
      <SectionCard icon={Lock} title="تغيير كلمة المرور" color="bg-amber-50 text-amber-700">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField label="كلمة المرور الحالية"
            value={pass.current} onChange={e => setPass(p => ({ ...p, current: e.target.value }))}
            placeholder="••••••••" autoComplete="current-password" />
          <PasswordField label="كلمة المرور الجديدة"
            value={pass.new} onChange={e => setPass(p => ({ ...p, new: e.target.value }))}
            placeholder="6 أحرف على الأقل" autoComplete="new-password" />
          <PasswordField label="تأكيد كلمة المرور الجديدة"
            value={pass.confirm} onChange={e => setPass(p => ({ ...p, confirm: e.target.value }))}
            placeholder="أعد إدخال كلمة المرور" autoComplete="new-password" />

          {/* Strength Indicator */}
          {pass.new && (
            <div>
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    pass.new.length >= i * 2
                      ? pass.new.length >= 8 ? 'bg-emerald-500' : 'bg-amber-400'
                      : 'bg-gray-200'
                  }`} />
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {pass.new.length < 6 ? 'ضعيف' : pass.new.length < 8 ? 'مقبول' : 'قوي'}
              </p>
            </div>
          )}

          {/* Match Indicator */}
          {pass.confirm && (
            <p className={`text-xs flex items-center gap-1 font-semibold ${
              pass.new === pass.confirm ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {pass.new === pass.confirm ? <><CheckCircle size={12} /> كلمتا المرور متطابقتان</> : '✗ كلمتا المرور غير متطابقتين'}
            </p>
          )}

          <button type="submit" disabled={savingPass}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            {savingPass
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <Shield size={14} />}
            {savingPass ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </SectionCard>

      {/* ── Notifications Section ── */}
      <SectionCard icon={Bell} title="إعدادات الإشعارات" color="bg-purple-50 text-purple-700">
        <div className="space-y-4">
          {[
            { key: 'queueAlerts', label: 'تنبيهات قائمة الانتظار', desc: 'إشعار عند إضافة مريض جديد' },
            { key: 'newPatients', label: 'المرضى الجدد', desc: 'إشعار عند تسجيل مريض جديد' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => setNotif(p => ({ ...p, [item.key]: !p[item.key] }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notif[item.key] ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <motion.div
                  animate={{ x: notif[item.key] ? 24 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Theme Toggler Section ── */}
      <SectionCard icon={Sun} title="مظهر النظام (Theme Mode)" color="bg-blue-50 text-blue-700">
        <div className="flex gap-4">
          <button
            onClick={() => toggleTheme('light')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
              theme === 'light'
                ? 'bg-amber-50/50 border-amber-400 text-amber-800'
                : 'bg-white border-gray-150 text-gray-500 hover:border-gray-250'
            }`}
          >
            <Sun size={20} className={theme === 'light' ? 'text-amber-500' : ''} />
            <span className="text-xs font-bold">الوضع الفاتح (Light)</span>
          </button>

          <button
            onClick={() => toggleTheme('dark')}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
              theme === 'dark'
                ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-inner'
                : 'bg-white border-gray-150 text-gray-500 hover:border-gray-250'
            }`}
          >
            <Moon size={20} className={theme === 'dark' ? 'text-blue-400' : ''} />
            <span className="text-xs font-bold">الوضع الداكن (Dark)</span>
          </button>
        </div>
      </SectionCard>

      {/* ── Reassuring Security Modal ── */}
      <AnimatePresence>
        {securityModalText && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              {/* Header */}
              <div className="p-5 bg-gradient-to-l from-amber-500/10 to-transparent border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg">
                  <Shield size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">حوكمة الأمان وتأمين الحساب</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">طلب تغيير كلمة المرور قيد المراجعة</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-xs font-semibold text-gray-700 leading-relaxed text-justify">
                  {securityModalText}
                </p>
                <div className="bg-amber-50/50 border border-amber-200/50 p-4 rounded-2xl flex items-start gap-3">
                  <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-amber-800 leading-normal">
                    وفقاً لحوكمة الأمان والرقابة المالية المشددة للنظام، يتطلب اعتماد تغيير كلمات المرور موافقة مدير النظام والمدقق المالي المباشر (Auditor) لحماية البيانات.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setSecurityModalText('')}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl text-xs shadow-md transition-all"
                >
                  فهمت، موافق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PersonalSettings;
