import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ClipboardList,
  Wallet,
  Stethoscope,
  FlaskConical,
  Radiation,
  Settings,
  Pill,
  Layers,
  Package,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Activity,
  Warehouse,
  X,
  ShieldAlert,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Archive,
  FileText,
  Star,
  Clock,
  CheckSquare,
  BarChart3,
  RefreshCcw,
} from "lucide-react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import GlobalSearch from "./GlobalSearch";
import useRealtimeNotifications from "../hooks/useRealtimeNotifications";
import { disconnectSocket } from "../utils/socket";

// ─── Menu config ──────────────────────────────────────────────────
const menuConfig = {
  secretary: [
    { icon: Activity, label: "لوحة التحكم", path: "/secretary/dashboard" },
    { icon: UserPlus, label: "تسجيل مريض", path: "/secretary/register" },
    { icon: Users, label: "أرشيف المرضى", path: "/secretary/patients" },
  ],
  cashier: [
    { icon: Activity, label: "لوحة العمليات", path: "/cashier/board" },
    { icon: ArrowLeftRight, label: "الإيرادات والمصروفات", path: "/cashier/general" },
    { icon: Archive, label: "الأرشيف المالي", path: "/cashier/archive" },
    { icon: FileText, label: "التقارير المالية", path: "/cashier/reports" },
  ],
  doctor: [
    { icon: Activity, label: "لوحة التحكم", path: "/doctor/dashboard" },
    { icon: Stethoscope, label: "قائمة المرضى", path: "/doctor/queue" },
    { icon: ShieldAlert, label: "معاينات جانبية", path: "/doctor/vip" },
    { icon: FolderOpen, label: "أرشيف المرضى", path: "/doctor/archive" },
    { icon: Star, label: "إدارة المفضلات", path: "/doctor/favorites" },
    { icon: Users, label: "إدارة المستخدمين", path: "/doctor/users" },
    { icon: TrendingUp, label: "التقارير التحليلية", path: "/doctor/reports" },
  ],

  lab: [
    { icon: Clock, label: "الطلبات الواردة", path: "/lab/pending" },
    {
      icon: RefreshCcw,
      label: "التحاليل قيد الإجراء",
      path: "/lab/in-progress",
    },
    { icon: CheckSquare, label: "التحاليل المنجزة", path: "/lab/completed" },
    {
      icon: BarChart3,
      label: "تقارير الأداء والإحصائيات",
      path: "/lab/reports",
    },
  ],
  radiology: [
    { icon: Clock, label: "الطلبات الواردة", path: "/radiology/pending" },
    {
      icon: Radiation,
      label: "التصوير قيد الإجراء",
      path: "/radiology/in-progress",
    },
    {
      icon: CheckSquare,
      label: "الفحوصات المنجزة",
      path: "/radiology/completed",
    },
    {
      icon: BarChart3,
      label: "تقارير الأداء والإحصائيات",
      path: "/radiology/reports",
    },
  ],
  surgery_coordinator: [
    { icon: Scissors, label: "العمليات", path: "/surgery/operations" },
  ],
  or_store: [{ icon: Package, label: "مخزن العمليات", path: "/or-store" }],
  general_store: [
    { icon: Warehouse, label: "المخزن العام", path: "/general-store" },
  ],
  auditor: [
    {
      group: "إدارة الإحصائيات والتقارير",
      items: [
        { icon: Activity, label: "لوحة التقارير", path: "/auditor/dashboard" },
        { icon: Wallet, label: "التقرير المالي", path: "/auditor/financial" },
        { icon: Scissors, label: "أداء العمليات", path: "/auditor/surgery" },
        { icon: Users, label: "المرضى والزيارات", path: "/auditor/patients" },
        {
          icon: FlaskConical,
          label: "الخدمات التشخيصية",
          path: "/auditor/diagnostics",
        },
        {
          icon: Warehouse,
          label: "التقرير المخزني",
          path: "/auditor/inventory",
        },
        { icon: ClipboardList, label: "سجل الرصد", path: "/auditor/audit" },
      ],
    },
    {
      group: "إدارة النظام والتحكم",
      items: [
        { icon: Users, label: "إدارة المستخدمين", path: "/auditor/users" },
        {
          icon: Pill,
          label: "دليل الأدوية",
          path: "/auditor/catalog/medications",
        },
        {
          icon: Layers,
          label: "الخدمات السريرية",
          path: "/auditor/catalog/clinical",
        },
        {
          icon: Package,
          label: "باقات العمليات",
          path: "/auditor/catalog/surgery-prep",
        },
        {
          icon: FlaskConical,
          label: "كتالوج التحاليل",
          path: "/auditor/catalog/lab",
        },
        {
          icon: Radiation,
          label: "كتالوج الأشعة",
          path: "/auditor/catalog/radiology",
        },
        {
          icon: Settings,
          label: "إعدادات النظام",
          path: "/auditor/system-settings",
        },
        {
          icon: ClipboardList,
          label: "سجل الأحداث الكامل",
          path: "/auditor/audit-log",
        },
      ],
    },
  ],
};

const roleLabels = {
  secretary: "سكرتير",
  cashier: "أمين الصندوق",
  doctor: "طبيب",
  lab: "مختبر",
  radiology: "أشعة",
  surgery_coordinator: "منسق عمليات",
  or_store: "مخزن العمليات",
  general_store: "المخزن العام",
  auditor: "مدير النظام",
};

const ROLE_GRADIENT = {
  doctor: "linear-gradient(180deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%)",
  secretary: "linear-gradient(180deg, #134E4A 0%, #0F766E 60%, #0D9488 100%)",
  cashier: "linear-gradient(180deg, #1C1917 0%, #292524 60%, #44403C 100%)",
  lab: "linear-gradient(180deg, #4C1D95 0%, #6D28D9 60%, #7C3AED 100%)",
  radiology: "linear-gradient(180deg, #1E3A8A 0%, #1D4ED8 60%, #3B82F6 100%)",
  auditor: "linear-gradient(180deg, #0F172A 0%, #1E293B 60%, #334155 100%)",
  default: "linear-gradient(180deg, #1F2937 0%, #374151 60%, #4B5563 100%)",
};

// ─── Sidebar Item ─────────────────────────────────────────────────
const SidebarItem = ({ icon: Icon, label, path, active, collapsed }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(path)}
      
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-right transition-all active:scale-95 ${
        active
          ? "bg-white/20 text-white shadow-sm"
          : "text-blue-100/80 hover:bg-white/10 hover:text-white"
      }`}>
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
          active ? "bg-white/25 shadow-inner" : "bg-white/8"
        }`}>
        <Icon size={18} />
      </div>
      
        {!collapsed && (
          <span
            className="animate-fade-in"
            className="text-sm font-semibold whitespace-nowrap overflow-hidden">
            {label}
          </span>
        )}
      
      {active && !collapsed && (
        <div
          className="animate-fade-in"
          className="w-1.5 h-1.5 rounded-full bg-white mr-auto flex-shrink-0"
        />
      )}
    </button>
  );
};

// ─── Notification Bell ────────────────────────────────────────────
const NotificationBell = () => {
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const unread = notes.filter((n) => !n.read).length;

  // listen to socket events and collect as notifications
  useEffect(() => {
    const { getSocket } = require("../utils/socket");
    const socket = getSocket();
    const add = (msg) =>
      setNotes((p) =>
        [{ id: Date.now(), msg, read: false, time: new Date() }, ...p].slice(
          0,
          30,
        ),
      );
    socket.on("patient:registered", ({ message }) => add(message));
    socket.on("patient:waiting", ({ message }) => add(message));
    socket.on("request:new", ({ message }) => add(message));
    return () => {
      socket.off("patient:registered");
      socket.off("patient:waiting");
      socket.off("request:new");
    };
  }, []);

  const markAll = () => setNotes((p) => p.map((n) => ({ ...n, read: true })));

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markAll();
        }}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500">
        <Bell size={20} />
        {unread > 0 && (
          <span
            className="animate-scale-in"
            className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full ring-2 ring-white text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      
        {open && (
          <div
            className="animate-slide-up"
            className="absolute left-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
            dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-800 text-sm">الإشعارات</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  لا توجد إشعارات
                </div>
              ) : (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 text-sm ${n.read ? "text-gray-500" : "text-gray-800 bg-blue-50/50"}`}>
                    <p className="font-semibold">{n.msg}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.time).toLocaleTimeString("ar", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      
    </div>
  );
};

// ─── Main Layout ─────────────────────────────────────────────────
const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // 🔔 Real-time notifications
  useRealtimeNotifications(user?.role);

  const items = menuConfig[user?.role] || [];
  const roleName = roleLabels[user?.role] || user?.role;
  const gradient = ROLE_GRADIENT[user?.role] || ROLE_GRADIENT.default;

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate("/login");
  };

  const getFlatItems = (menuItems) => {
    let flat = [];
    menuItems.forEach((i) => {
      if (i.group) {
        flat = flat.concat(i.items);
      } else {
        flat.push(i);
      }
    });
    return flat;
  };
  const flatItems = getFlatItems(items);
  const currentLabel =
    flatItems.find((i) => location.pathname.startsWith(i.path))?.label ||
    "لوحة التحكم";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" dir="rtl">
      {/* ── Sidebar ── */}
      <aside
        
        className="flex flex-col h-full flex-shrink-0 relative z-40 transition-all duration-300"
        style={{ background: gradient, width: collapsed ? 72 : 224 }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Stethoscope size={20} className="text-blue-700" />
          </div>
          
            {!collapsed && (
              <div
                className="animate-fade-in">
                <p className="text-white font-bold text-sm leading-none">
                  ORTHOCARE
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  نظام الإدارة الطبية
                </p>
              </div>
            )}
          
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-4 space-y-3">
          {items.map((itemOrGroup, idx) => {
            if (itemOrGroup.group) {
              return (
                <div key={itemOrGroup.group + idx} className="space-y-1">
                  {!collapsed && (
                    <p className="text-[10px] font-bold text-blue-200/50 uppercase tracking-widest px-3 mb-2 mt-4 text-right">
                      {itemOrGroup.group}
                    </p>
                  )}
                  {itemOrGroup.items.map((item) => (
                    <SidebarItem
                      key={item.path}
                      {...item}
                      active={location.pathname.startsWith(item.path)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              );
            }
            return (
              <SidebarItem
                key={itemOrGroup.path}
                {...itemOrGroup}
                active={location.pathname.startsWith(itemOrGroup.path)}
                collapsed={collapsed}
              />
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1">
          <SidebarItem
            icon={Settings}
            label="الإعدادات"
            path="/settings"
            active={false}
            collapsed={collapsed}
          />
          <button
            onClick={handleLogout}
            
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all active:scale-95">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <LogOut size={18} />
            </div>
            
              {!collapsed && (
                <span
                  className="animate-fade-in"
                  className="text-sm font-semibold whitespace-nowrap overflow-hidden">
                  تسجيل الخروج
                </span>
              )}
            
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          
          className="absolute -left-3.5 top-16 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 shadow-md z-50 hover-lift active:scale-95">
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-5 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-none">
                {currentLabel}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                ORTHOCARE · {roleName}
              </p>
            </div>
          </div>

          {/* Center: Global Search */}
          <div className="flex-1 max-w-xs mx-6">
            <GlobalSearch />
          </div>

          {/* Right: Bell + User */}
          <div className="flex items-center gap-3">
            <NotificationBell />

            <div className="flex items-center gap-3 pr-3 border-r border-gray-100">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-none">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{roleName}</p>
              </div>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md cursor-pointer"
                style={{ background: gradient, width: collapsed ? 72 : 224 }}>
                {user?.fullName?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col">
          <div
            key={location.pathname}
            className="flex-1 flex flex-col animate-fade-in"
            >
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
