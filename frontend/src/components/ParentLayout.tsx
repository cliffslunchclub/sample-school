import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Users, CalendarDays, ClipboardList, UserCog, LogOut, UtensilsCrossed } from "lucide-react";
import { Brand } from "./Brand";
import { useAuth } from "../lib/auth";
import { SemesterProvider } from "../lib/SemesterContext";

const nav = [
  { to: "/menu",        label: "Menu",           icon: UtensilsCrossed },
  { to: "/students",    label: "My Students",    icon: Users           },
  { to: "/meals",       label: "Meal Selection", icon: CalendarDays    },
  { to: "/orders",      label: "My Orders",      icon: ClipboardList   },
  { to: "/account",     label: "Account",        icon: UserCog         },
];

export default function ParentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Brand size="sm" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold text-ink-soft sm:block">
              {user?.first_name} {user?.last_name}
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-cream-deep hover:text-ink"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        {/* Desktop tabs */}
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 sm:flex">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-leaf-600 text-leaf-700"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:pb-10">
        <SemesterProvider>
          <Outlet />
        </SemesterProvider>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-cream/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                  isActive ? "text-leaf-700" : "text-ink-faint"
                }`
              }
            >
              <n.icon className="h-5 w-5" />
              {n.label.replace("My ", "")}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
