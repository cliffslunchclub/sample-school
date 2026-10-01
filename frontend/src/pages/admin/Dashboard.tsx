import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users2, GraduationCap, UtensilsCrossed, Table2, Sigma, FileUp, ArrowRight, UserPlus } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Spinner } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";

export default function Dashboard() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const count = async (col: string, filter = "") =>
        (await pb.collection(col).getList(1, 1, { filter, requestKey: null, skipTotal: false })).totalItems;
      const [parents, students, menu, orders] = await Promise.all([
        count("users", 'role = "parent"'),
        count("students", "active = true"),
        count("menu_items", "active = true"),
        count("meal_selections"),
      ]);
      setStats({ parents, students, menu, orders });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;

  const cards = [
    { label: "Parents",           value: stats.parents,  icon: Users2,          to: "/admin/parents"  },
    { label: "Active students",   value: stats.students, icon: GraduationCap,   to: "/admin/students" },
    { label: "Active menu items", value: stats.menu,     icon: UtensilsCrossed, to: "/admin/menu"     },
    { label: "Total orders",      value: stats.orders,   icon: Table2,          to: "/admin/orders"   },
  ];

  const quick = [
    { label: "View all orders",  desc: "Spreadsheet of every meal selection",   icon: Table2,   to: "/admin/orders"   },
    { label: "Order summary",    desc: "Totals by menu item and delivery time", icon: Sigma,    to: "/admin/summary"  },
    { label: "Import data",      desc: "Bring in rosters and existing orders",  icon: FileUp,   to: "/admin/import"   },
    { label: "Manage students",  desc: "Add, edit or deactivate students",      icon: UserPlus, to: "/admin/students" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" desc="Overview of your school lunch program" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-100 text-leaf-700">
                <c.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-extrabold text-ink">{c.value ?? 0}</p>
              <p className="text-sm font-semibold text-ink-soft">{c.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-extrabold text-ink">Quick actions</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quick.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 transition-colors hover:border-leaf-400 hover:bg-leaf-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-leaf-100 text-leaf-700">
                  <q.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{q.label}</p>
                  <p className="truncate text-xs text-ink-faint">{q.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
