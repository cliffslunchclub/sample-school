import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Table2, Sigma, GraduationCap, Users2,
  UtensilsCrossed, School, Clock, Settings as SettingsIcon,
  History, FileUp, LogOut, Menu as MenuIcon, X, BookOpen,
} from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "../lib/auth";
import { SemesterProvider } from "../lib/SemesterContext";

const nav = [
  { to: "/admin",                label: "Dashboard",       icon: LayoutDashboard, end: true },
  { to: "/admin/orders",         label: "Orders",          icon: Table2 },
  { to: "/admin/summary",        label: "Order Summary",   icon: Sigma },
  { to: "/admin/students",       label: "Students",        icon: GraduationCap },
  { to: "/admin/labels", label: "Lunch Labels", icon: Table2 },
  { to: "/admin/admins", label: "Administrators", icon: Users2 },
  { to: "/admin/parents",        label: "Parents",         icon: Users2 },
  { to: "/admin/menu",           label: "Menu",            icon: UtensilsCrossed },
  { to: "/admin/grades",         label: "Grades & Teachers", icon: School },
  { to: "/admin/delivery-times", label: "Delivery Times",  icon: Clock },
  { to: "/admin/import",         label: "Import Data",     icon: FileUp },
  { to: "/admin/settings",       label: "Settings",        icon: SettingsIcon },
  { to: "/admin/audit",          label: "Admin Audit Logs",       icon: History },
];

nav.push({ to: "/admin/parent-audit", label: "Parent Audit Log", icon: History });

const guides = [
  { to: "/admin/guide/parent", label: "Parent Guide" },
  { to: "/admin/guide/admin",  label: "Admin Guide"  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const NavItems = () => (
    <nav className="flex flex-col gap-0.5 px-3">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
              isActive
                ? "bg-leaf-600 text-white shadow-sm"
                : "text-ink-soft hover:bg-leaf-50 hover:text-ink"
            }`
          }
        >
          <n.icon className="h-[18px] w-[18px]" /> {n.label}
        </NavLink>
      ))}
      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 flex items-center gap-2 px-3 text-[11px] font-extrabold uppercase tracking-widest text-ink-faint">
          <BookOpen className="h-3.5 w-3.5" /> Guides
        </p>
        {guides.map((g) => (
          <NavLink
            key={g.to}
            to={g.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                isActive
                  ? "bg-leaf-600 text-white shadow-sm"
                  : "text-ink-soft hover:bg-leaf-50 hover:text-ink"
              }`
            }
          >
            {g.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream lg:flex">
      {/* Sidebar desktop */}
      <aside className="print:hidden sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5">
          <Brand size="sm" />
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll">
          <NavItems />
        </div>
        <div className="border-t border-line p-3">
          <div className="mb-2 px-2 text-xs font-bold text-ink-faint">
            {user?.first_name} {user?.last_name} · Admin
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-tomato-50 hover:text-tomato-600"
          >
            <LogOut className="h-[18px] w-[18px]" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="print:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Brand size="sm" />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink hover:bg-cream-deep">
          <MenuIcon className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div className="animate-pop-in absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface py-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between px-5">
              <Brand size="sm" />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems />
            <div className="mt-3 border-t border-line px-3 pt-3">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-tomato-600 hover:bg-tomato-50"
              >
                <LogOut className="h-[18px] w-[18px]" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
          <SemesterProvider>
            <Outlet />
          </SemesterProvider>
        </div>
      </main>
    </div>
  );
}
