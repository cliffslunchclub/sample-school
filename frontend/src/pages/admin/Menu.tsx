import { useEffect, useState } from "react";
import { Plus, Pencil, UtensilsCrossed } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Button, Input, Textarea, Field, Modal, Spinner, EmptyState, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { MenuItem } from "../../lib/types";

const DAY_OPTIONS: ("Monday" | "Wednesday")[] = ["Monday", "Wednesday"];

export default function Menu() {
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const mi = await pb.collection("menu_items").getFullList<MenuItem>({ sort: "name", requestKey: null });
    setItems(mi);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (m: MenuItem) => {
    await pb.collection("menu_items").update(m.id, { active: !m.active });
    toast(m.active ? "Item deactivated" : "Item activated");
    load();
  };

  if (loading) return <Spinner label="Loading menu…" />;

  return (
    <div>
      <PageHeader
        title="Menu"
        desc="Manage available meals per service day"
        action={<Button size="lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-5 w-5" /> Add Item</Button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-7 w-7" />} title="No menu items yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-ink">{m.name}</p>
                <button onClick={() => { setEditing(m); setOpen(true); }} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {m.description && <p className="mt-1 text-sm text-ink-soft">{m.description}</p>}
              <div className="mt-auto pt-3 flex flex-wrap items-center gap-1.5">
                <button onClick={() => toggleActive(m)}>
                  <Badge tone={m.active ? "green" : "red"}>{m.active ? "Active" : "Inactive"}</Badge>
                </button>
                {(m.days ?? []).map((d) => (
                  <Badge key={d} tone="blue">{d}</Badge>
                ))}
                {(m.days ?? []).length === 0 && (
                  <Badge tone="yellow">No days set</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <MenuForm
          key={editing?.id ?? "new"}
          item={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); load(); toast(editing ? "Item updated" : "Item added"); }}
        />
      )}
    </div>
  );
}

function MenuForm({
  item, onClose, onSaved,
}: {
  item: MenuItem | null; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [days, setDays] = useState<("Monday" | "Wednesday")[]>(item?.days ?? ["Monday", "Wednesday"]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: "Monday" | "Wednesday") =>
    setDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (days.length === 0) {
      toast("Select at least one service day", "error");
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await pb.collection("menu_items").update(item.id, { name, description, active, days });
      } else {
        await pb.collection("menu_items").create({ name, description, active, days, school: user!.school });
      }
      onSaved();
    } catch {
      toast("Could not save item", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={item ? "Edit Menu Item" : "Add Menu Item"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Available on">
          <div className="flex gap-4 pt-0.5">
            {DAY_OPTIONS.map((day) => (
              <label key={day} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="h-4 w-4 accent-[oklch(0.5_0.13_155)]"
                />
                {day}
              </label>
            ))}
          </div>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[oklch(0.5_0.13_155)]" />
          Active (shown to parents)
        </label>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>{item ? "Save changes" : "Add item"}</Button>
        </div>
      </form>
    </Modal>
  );
}
