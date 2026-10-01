import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, Pencil, Table2, X, Download, Plus } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Select, Input, Spinner, EmptyState, Button, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { MealOverrideModal } from "../../components/MealOverrideModal";
import { NewOrderModal } from "../../components/NewOrderModal";
import { formatDateTime } from "../../lib/format";
import { lunchDates, keyOf } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import { toCsv, downloadFile } from "../../lib/csv";
import type {
  MealSelection as Sel, DeliveryTime, Grade, Teacher, MenuItem, DeliveryRule, Student,
} from "../../lib/types";

type SortKey = "date" | "time" | "meal" | "student" | "grade" | "teacher" | "parent" | "modified";

/** Derive weekday label from a PocketBase date string safely. */
function lunchWeekday(dateStr: string): "Monday" | "Wednesday" {
  const key = keyOf(dateStr); // "YYYY-MM-DD"
  return new Date(key + "T12:00:00Z").getUTCDay() === 1 ? "Monday" : "Wednesday";
}

export default function Orders() {
  const [orders, setOrders] = useState<Sel[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [times, setTimes] = useState<DeliveryTime[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [rules, setRules] = useState<DeliveryRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [fDay, setFDay] = useState<"" | "Monday" | "Wednesday">("");
  const [fTime, setFTime] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [fTeacher, setFTeacher] = useState("");
  const [fMenu, setFMenu] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const [editing, setEditing] = useState<Sel | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const { start, end } = useSemester();
  const days = useMemo(() => lunchDates(start, end), [start, end]);

  const load = async () => {
    const [ord, st, dt, gr, te, mi, dr] = await Promise.all([
      pb.collection("meal_selections").getFullList<Sel>({
        expand: "student,student.grade,student.teacher,menu_item,delivery_time,parent",
        sort: "-updated",
        requestKey: null,
      }),
      pb.collection("students").getFullList<Student>({
        filter: "active = true", expand: "grade,teacher", sort: "name", requestKey: null,
      }),
      pb.collection("delivery_time_slots").getFullList<DeliveryTime>({ sort: "sort_order", requestKey: null }),
      pb.collection("grades").getFullList<Grade>({ sort: "sort_order", requestKey: null }),
      pb.collection("teachers").getFullList<Teacher>({ sort: "name", requestKey: null }),
      pb.collection("menu_items").getFullList<MenuItem>({ filter: "active = true", sort: "name", requestKey: null }),
      pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
    ]);
    setOrders(ord); setStudents(st); setTimes(dt); setGrades(gr); setTeachers(te); setMenu(mi); setRules(dr);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = orders.filter((o) => {
      const st = o.expand?.student;
      if (fDay && lunchWeekday(o.lunch_date) !== fDay) return false;
      if (fTime && o.delivery_time !== fTime) return false;
      if (fGrade && st?.grade !== fGrade) return false;
      if (fTeacher && st?.teacher !== fTeacher) return false;
      if (fMenu && o.menu_item !== fMenu) return false;
      if (term) {
        const hay = `${st?.name ?? ""} ${o.expand?.parent?.first_name ?? ""} ${o.expand?.parent?.last_name ?? ""} ${o.expand?.menu_item?.name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const val = (o: Sel): string | number => {
      switch (sortKey) {
        case "date":     return o.lunch_date ?? "";
        case "time":     return o.expand?.delivery_time?.label ?? "";
        case "meal":     return o.expand?.menu_item?.name ?? "";
        case "student":  return o.expand?.student?.name ?? "";
        case "grade":    return o.expand?.student?.expand?.grade?.name ?? "";
        case "teacher":  return o.expand?.student?.expand?.teacher?.name ?? "";
        case "parent":   return `${o.expand?.parent?.last_name ?? ""} ${o.expand?.parent?.first_name ?? ""}`;
        case "modified": return o.updated;
        default:         return "";
      }
    };
    list = [...list].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return list;
  }, [orders, q, fDay, fTime, fGrade, fTeacher, fMenu, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(1); }
  };

  const filterTeachers = fGrade ? teachers.filter((t) => t.grade === fGrade) : teachers;
  const anyFilter = fDay || fTime || fGrade || fTeacher || fMenu || q;
  const clearFilters = () => { setQ(""); setFDay(""); setFTime(""); setFGrade(""); setFTeacher(""); setFMenu(""); };

  const exportCsv = () => {
    const rows = [
      ["Lunch Day", "Delivery Time", "Menu Item", "Student", "Grade", "Teacher", "Parent", "Last Modified"],
      ...filtered.map((o) => [
        lunchWeekday(o.lunch_date),
        o.expand?.delivery_time?.label ?? "",
        o.expand?.menu_item?.name ?? "",
        o.expand?.student?.name ?? "",
        o.expand?.student?.expand?.grade?.name ?? "",
        o.expand?.student?.expand?.teacher?.name ?? "",
        `${o.expand?.parent?.first_name ?? ""} ${o.expand?.parent?.last_name ?? ""}`.trim(),
        formatDateTime(o.updated),
      ]),
    ];
    downloadFile(`cliffs-orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  const cols: { key: SortKey; label: string }[] = [
    { key: "date",     label: "Lunch Day"     },
    { key: "time",     label: "Delivery Time" },
    { key: "meal",     label: "Menu Item"     },
    { key: "student",  label: "Student"       },
    { key: "grade",    label: "Grade"         },
    { key: "teacher",  label: "Teacher"       },
    { key: "parent",   label: "Parent"        },
    { key: "modified", label: "Last Modified" },
  ];

  if (loading) return <Spinner label="Loading orders…" />;

  return (
    <div>
      <PageHeader
        title="Orders"
        desc={`${filtered.length} of ${orders.length} orders`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => setAddingNew(true)}>
              <Plus className="h-4 w-4" /> New Order
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <Card className="mb-4 p-4">
        {/* Search + clear row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search student, parent or meal…"
              className="pl-9"
            />
          </div>
          {anyFilter && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {/* Always-visible filter row */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={fDay} onChange={(e) => setFDay(e.target.value as "" | "Monday" | "Wednesday")}>
            <option value="">All days</option>
            <option value="Monday">Monday</option>
            <option value="Wednesday">Wednesday</option>
          </Select>
          <Select value={fTime} onChange={(e) => setFTime(e.target.value)}>
            <option value="">All delivery times</option>
            {times.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Select value={fGrade} onChange={(e) => { setFGrade(e.target.value); setFTeacher(""); }}>
            <option value="">All grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <Select value={fTeacher} onChange={(e) => setFTeacher(e.target.value)}>
            <option value="">All teachers</option>
            {filterTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={fMenu} onChange={(e) => setFMenu(e.target.value)}>
            <option value="">All menu items</option>
            {menu.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-7 w-7" />}
          title="No matching orders"
          desc="Try adjusting your filters or search."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/70">
                  {cols.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 font-extrabold text-ink hover:text-leaf-700"
                      >
                        {c.label}
                        <ArrowUpDown className={`h-3.5 w-3.5 ${sortKey === c.key ? "text-leaf-600" : "text-ink-faint/50"}`} />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-extrabold text-ink">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-leaf-50/40">
                    <td className="px-4 py-3 font-bold text-ink">{lunchWeekday(o.lunch_date)}</td>
                    <td className="px-4 py-3">
                      <Badge tone="sun">{o.expand?.delivery_time?.label ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{o.expand?.menu_item?.name}</td>
                    <td className="px-4 py-3 font-bold text-ink">{o.expand?.student?.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{o.expand?.student?.expand?.grade?.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{o.expand?.student?.expand?.teacher?.name}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {o.expand?.parent?.first_name} {o.expand?.parent?.last_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-faint">{formatDateTime(o.updated)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(o)}
                        className="rounded-lg p-2 text-ink-faint hover:bg-cream-deep hover:text-leaf-700"
                        aria-label="Edit order"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <MealOverrideModal
        open={!!editing}
        onClose={() => setEditing(null)}
        student={(editing?.expand?.student as Student) ?? null}
        lunchDates={days}
        fixedLunchKey={editing ? keyOf(editing.lunch_date) : undefined}
        currentMenuItem={editing?.menu_item}
        menuItems={menu}
        deliveryTimes={times}
        rules={rules}
        onSaved={() => { setEditing(null); load(); }}
      />

      <NewOrderModal
        open={addingNew}
        onClose={() => setAddingNew(false)}
        students={students}
        menuItems={menu}
        deliveryTimes={times}
        rules={rules}
        lunchDates={days}
        onSaved={() => { setAddingNew(false); load(); }}
      />
    </div>
  );
}
