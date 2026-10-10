import { useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Spinner } from "../../components/ui";
import type { MenuItem } from "../../lib/types";

import { WEEKDAYS } from "../../lib/semester";

export default function ParentMenu({ guest = false }: { guest?: boolean }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const request = guest
      ? pb.send("/api/public-menu", { method: "GET", requestKey: null }).then((result: { items: MenuItem[] }) => result.items)
      : pb.collection("menu_items").getFullList<MenuItem>({ filter: "active = true", sort: "name", requestKey: null });
    request.then(setItems).catch(() => setError("The menu could not be loaded. Please try again.")).finally(() => setLoading(false));
  }, [guest]);

  if (error) return <p role="alert" className="text-tomato-600">{error}</p>;
  if (loading) return <Spinner label="Loading menu…" />;



  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">This Week's Menu</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Fresh meals served Monday through Friday.
        </p>
      </div>

      <div className="space-y-8">
        {WEEKDAYS.map(day => <DaySection key={day} day={day} items={items.filter(m => m.days?.includes(day))} />)}
      </div>

      {items.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
            <UtensilsCrossed className="h-8 w-8" />
          </div>
          <p className="font-bold text-ink">No menu items yet</p>
          <p className="text-sm text-ink-soft">Check back soon — the lunch menu will appear here.</p>
        </div>
      )}
    </div>
  );
}

function DaySection({ day, items }: { day: string; items: MenuItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-lg font-extrabold text-ink">{day}</span>
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-bold text-ink-faint">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-line bg-white px-5 py-4 shadow-sm"
          >
            <p className="font-extrabold text-ink">{item.name}</p>
            {item.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

