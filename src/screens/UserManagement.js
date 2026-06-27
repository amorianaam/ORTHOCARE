import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus, Shield, ShieldOff, Key, X, Eye, EyeOff,
  User, Check, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';

const ROLE_LABELS = {
  doctor:               { label: 'طبيب',              color: 'bg-blue-100 text-blue-700' },
  secretary:            { label: 'سكرتير',            color: 'bg-gray-100 text-gray-700' },
  cashier:              { label: 'محاسب',              color: 'bg-green-100 text-green-700' },
  lab:                  { label: 'مختبر',              color: 'bg-yellow-100 text-yellow-700' },
  radiology:            { label: 'أشعة',              color: 'bg-purple-100 text-purple-700' },
  surgery_coordinator:  { label: 'منسق عمليات',       color: 'bg-orange-100 text-orange-700' },
  or_store:             { label: 'مخزن العمليات',     color: 'bg-red-100 text-red-700' },
  general_store:        { label: 'المخزن العام',      color: 'bg-teal-100 text-teal-700' },
  auditor:              { label: 'مدير التقارير',      color: 'bg-slate-100 text-slate-700' },
};

// ── Add User Modal ─────────────────────────────────────────────────
const AddUserModal = ({ onClose, onSuccess, token }) => {
  const [form, setForm] = useState({ fullName: '', username: '', role: 'secretary', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم إنشاء المستخدم بنجاح');
        onSuccess();
        onClose();
      } else toast.error(data.message);
    } catch { toast.error('فشل الاتصال بالخادم'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' }}
        >
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-800">إضافة مستخدم جديد</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم الكامل *</label>
            <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              required className="input-base" placeholder="الاسم الكامل للمستخدم" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المستخدم *</label>
            <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required autoComplete="username" className="input-base" placeholder="username" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الدور الوظيفي *</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="input-base"
            >
              {Object.entries(ROLE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور المؤقتة *</label>
            <div className="relative">
              <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required autoComplete="new-password" type={showPass ? 'text' : 'password'} className="input-base pl-10" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> سيُطلب من المستخدم تغييرها عند أول دخول
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Check size={16} />}
              {loading ? 'جاري الحفظ...' : 'إنشاء المستخدم'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Reset Password Modal ───────────────────────────────────────────
const ResetPasswordModal = ({ user, onClose, token }) => {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); onClose(); }
      else toast.error(data.message);
    } catch { toast.error('فشل الاتصال'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
      >
        <h3 className="font-bold text-gray-800 mb-1">إعادة تعيين كلمة المرور</h3>
        <p className="text-sm text-gray-500 mb-5">للمستخدم: <span className="font-semibold text-gray-700">{user.full_name}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="new-password" type={showPass ? 'text' : 'password'} className="input-base pl-10"
              placeholder="كلمة المرور الجديدة" minLength={6} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Main User Management Screen ────────────────────────────────────
const UserManagement = () => {
  const { token } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل المستخدمين'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/toggle`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.message);
    } catch { toast.error('فشل التحديث'); }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} مستخدم مسجل في النظام</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} />
          إضافة مستخدم
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['الاسم', 'اسم الدخول', 'الدور', 'آخر دخول', 'الحالة', 'إجراءات'].map(h => (
                <th key={h} className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3].map(i => (
                <tr key={i}>
                  {[1,2,3,4,5,6].map(j => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.map((u, i) => {
              const role = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600' };
              return (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {u.full_name?.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-800">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-gray-600 text-xs">{u.username}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${role.color}`}>
                      {role.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString('ar') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggle(u.id)}
                        title={u.is_active ? 'تعطيل' : 'تفعيل'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.is_active
                            ? 'bg-red-50 text-red-500 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {u.is_active ? <ShieldOff size={15} /> : <Shield size={15} />}
                      </button>
                      <button
                        onClick={() => setResetUser(u)}
                        title="إعادة تعيين كلمة المرور"
                        className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                      >
                        <Key size={15} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showAddModal && (
          <AddUserModal
            token={token}
            onClose={() => setShowAddModal(false)}
            onSuccess={fetchUsers}
          />
        )}
        {resetUser && (
          <ResetPasswordModal
            user={resetUser}
            token={token}
            onClose={() => setResetUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
