import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CalendarDays, Clock, Utensils } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, EmptyState, Spinner, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { weekdayOf, isKeyEditable, keyOf } from "../../lib/semester";
import type { MealSelection as Sel } from "../../lib/types";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Sel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await pb.collection("meal_selections").getFullList<Sel>({
        filter: `parent = "${user!.id}"`,
        expand: "student,student.grade,student.teacher,menu_item,delivery_time",
        sort: "-lunch_date",
        requestKey: null,
      });
      setOrders(res);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; items: Sel[] }>();
    orders.forEach((o) => {
      const k = keyOf(o.lunch_date);
      const entry = map.get(k) ?? { key: k, items: [] };
      entry.items.push(o);
      map.set(k, entry);
    });
    // Sort: newest week first; within the same week Monday through Friday
    const weekOf = (key: string) => {
      const d = new Date(key + "T12:00:00Z");
      if (d.getUTCDay() === 1) return key; // already Monday
      const mon = new Date(d);
      mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return mon.toISOString().slice(0, 10);
    };
    return Array.from(map.values()).sort((a, b) => {
      const wa = weekOf(a.key), wb = weekOf(b.key);
      if (wa !== wb) return wb.localeCompare(wa); // newer week first
      return a.key.localeCompare(b.key);           // Mon before Wed
    });
  }, [orders]);

  if (loading) return <Spinner label="Loading your orders…" />;

  return (
    <div>
      <PageHeader title="My Orders" desc="Every meal you've selected, saved for your records" />
      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-7 w-7" />}
          title="No orders yet"
          desc="Once you save meal selections, they'll appear here."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ key, items }) => {
            const editable = isKeyEditable(key);
            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-cream/60 px-5 py-3">
                  <div className="flex items-center gap-2 font-extrabold text-ink">
                     <CalendarDays className="h-5 w-5 text-leaf-600" />
                     {weekdayOf(items[0].lunch_date)}
                   </div>
                  <Badge tone={editable ? "green" : "neutral"}>{editable ? "Editable" : "Locked"}</Badge>
                </div>
                <div className="divide-y divide-line">
                  {items.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div>
                        <p className="font-bold text-ink">{o.expand?.student?.name}</p>
                        <p className="text-xs text-ink-faint">
                          {o.expand?.student?.expand?.grade?.name} — {o.expand?.student?.expand?.teacher?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                          <Utensils className="h-4 w-4 text-tomato-500" />
                          {o.expand?.menu_item?.name}
                        </div>
                        {o.expand?.delivery_time && (
                          <span className="hidden items-center gap-1 text-sm font-semibold text-ink-soft sm:flex">
                            <Clock className="h-4 w-4" /> {o.expand.delivery_time.label}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
