import { useEffect, useState } from "react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { useSemester } from "../../lib/SemesterContext";
import { orderingWindow, orderingDayText } from "../../lib/semester";
import { Card, Select, Button, Spinner, useToast, EmptyState } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { Student, MenuItem, DeliveryRule, MealSelection } from "../../lib/types";

export default function RecurringMondaySelection() {
  const { user } = useAuth();
  const { orderingDays } = useSemester();
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [rules, setRules] = useState<DeliveryRule[]>([]);
  const [orders, setOrders] = useState<MealSelection[]>([]);
  const [draft, setDraft] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = orderingWindow(new Date(), orderingDays).open;

  const load = async () => {
    setError("");
    try {
      const [st, items, deliveryRules, mealOrders] = await Promise.all([
        pb.collection("students").getFullList<Student>({
          filter: `parent = "${user!.id}" && active = true`, expand: "grade,teacher", sort: "name", requestKey: null,
        }),
        pb.collection("menu_items").getFullList<MenuItem>({ filter: "active = true", sort: "name", requestKey: null }),
        pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
        pb.collection("meal_selections").getFullList<MealSelection>({
          filter: `parent = "${user!.id}" && recurring_weekday = "Monday"`,
          requestKey: null,
        }),
      ]);
      setStudents(st);setMenu(items);setRules(deliveryRules);setOrders(mealOrders);
      const d:Record<string,string>={};
      for (const s of mealOrders) if (!d[s.student]) d[s.student]=s.menu_item;
      setDraft(d);
    } catch {
      setError("Could not load recurring meals. Try reloading the page.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const deriveDeliveryTime = (s:Student) =>
    rules.find(r=>r.teacher===s.teacher && r.teacher)?.delivery_time
    || rules.find(r=>r.grade===s.grade && !r.teacher)?.delivery_time || "";

  const save = async () => {
    if (!open) return;
    setSaving(true);
    try {
      let changed=0;
      for (const s of students) {
        const item=draft[s.id];
        if (!item) continue;
        const old=orders.find(o=>o.student===s.id);
        if (old?.menu_item===item) continue;
        const body={
          student:s.id,menu_item:item,delivery_time:deriveDeliveryTime(s),
          parent:user!.id,school:user!.school,recurring_weekday:"Monday",lunch_date:"",
        };
        if (old) await pb.collection("meal_selections").update(old.id,body);
        else await pb.collection("meal_selections").create(body);
        changed++;
      }
      await load();
      toast(changed ? `Saved ${changed} recurring Monday selection${changed===1?"":"s"}` : "No changes needed");
    } catch {
      toast("Could not save Monday selections", "error");
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner label="Loading recurring meals…" />;
  return <div className="space-y-4">
    <PageHeader title="Monday Meal Selection" desc="Your Monday selection repeats each week until you change it."
      action={open ? <Button onClick={save} loading={saving}>Save Monday Selections</Button> : undefined}/>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!open && <Card className="p-4 text-sm text-ink-soft">Ordering changes are closed. You can review your Monday meals now; editing reopens on {orderingDayText(orderingDays)}.</Card>}
    {students.length===0 ? <EmptyState title="No students" desc="Add a student before selecting a Monday meal."/> : students.map(s=>
      <Card key={s.id} className="p-5">
        <div className="mb-2 font-extrabold">{s.name}</div>
        <p className="mb-3 text-xs text-ink-soft">{s.expand?.grade?.name} — {s.expand?.teacher?.name}</p>
        <Select disabled={!open} value={draft[s.id]||""} onChange={e=>setDraft(d=>({...d,[s.id]:e.target.value}))}>
          <option value="">Select Monday meal…</option>
          {menu.filter(m=>m.days?.includes("Monday")).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        {orders.filter(o=>o.student===s.id).length>1 && <p className="mt-2 text-xs text-ink-soft">Additional Monday lunches are saved. Contact the school to change or remove an extra lunch.</p>}
      </Card>
    )}
  </div>;
}
