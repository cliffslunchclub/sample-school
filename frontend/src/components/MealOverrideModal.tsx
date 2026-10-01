import { useEffect, useState } from "react";
import { Modal, Field, Select, Textarea, Button, useToast } from "./ui";
import { adminSetMeal, deriveDeliveryTime } from "../lib/admin";
import { keyOf, type LunchDate } from "../lib/semester";
import { useAuth } from "../lib/auth";
import type { Student, MenuItem, DeliveryTime, DeliveryRule } from "../lib/types";

type Weekday = "Monday" | "Wednesday";

/** Pick the next upcoming occurrence of a weekday, or the first one in the list as fallback. */
function resolveKey(weekday: Weekday, lunchDates: LunchDate[]): string {
  const today = keyOf(new Date().toISOString());
  const matches = lunchDates.filter((d) => d.weekday === weekday);
  const upcoming = matches.find((d) => d.key >= today);
  return (upcoming ?? matches[0])?.key ?? "";
}

/** Derive weekday label from a YYYY-MM-DD key. */
function keyToWeekday(key: string): Weekday {
  return new Date(key + "T12:00:00Z").getUTCDay() === 1 ? "Monday" : "Wednesday";
}

export function MealOverrideModal({
  open,
  onClose,
  student,
  lunchDates,
  fixedLunchKey,
  currentMenuItem,
  menuItems,
  deliveryTimes,
  rules,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  lunchDates: LunchDate[];
  fixedLunchKey?: string;
  currentMenuItem?: string;
  menuItems: MenuItem[];
  deliveryTimes: DeliveryTime[];
  rules: DeliveryRule[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();

  // When fixedLunchKey is given, weekday is derived from it (read-only).
  // When free, admin picks Monday or Wednesday and we resolve to the next occurrence.
  const [weekday, setWeekday] = useState<Weekday>("Monday");
  const [menuItem, setMenuItem] = useState(currentMenuItem ?? "");
  const [deliveryTimeId, setDeliveryTimeId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWeekday(fixedLunchKey ? keyToWeekday(fixedLunchKey) : "Monday");
    setMenuItem(currentMenuItem ?? "");
    setReason("");
    if (student) setDeliveryTimeId(deriveDeliveryTime(student, rules));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedLunchKey, currentMenuItem, student]);

  if (!student) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuItem) {
      toast("Choose a meal", "error");
      return;
    }
    const lunchKey = fixedLunchKey ?? resolveKey(weekday, lunchDates);
    if (!lunchKey) {
      toast("No matching lunch date found", "error");
      return;
    }
    setSaving(true);
    try {
      await adminSetMeal({
        student,
        lunchKey,
        newMenuItem: menuItem,
        deliveryTimeId,
        reason,
        adminId: user!.id,
        schoolId: user!.school,
        rules,
      });
      onSaved();
    } catch {
      toast("Could not save the change", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change meal">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-cream-deep px-4 py-3">
          <p className="font-extrabold text-ink">{student.name}</p>
          <p className="text-sm text-ink-soft">
            {student.expand?.grade?.name} — {student.expand?.teacher?.name}
          </p>
        </div>

        <Field label="Lunch day" required>
          {fixedLunchKey ? (
            /* Read-only when editing an existing order */
            <div className="flex h-11 items-center rounded-xl border border-line bg-cream-deep px-4 text-sm font-bold text-ink-soft">
              {keyToWeekday(fixedLunchKey)}
            </div>
          ) : (
            <Select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value as Weekday)}
              required
            >
              <option value="Monday">Monday</option>
              <option value="Wednesday">Wednesday</option>
            </Select>
          )}
        </Field>

        <Field label="New meal" required>
          <Select value={menuItem} onChange={(e) => setMenuItem(e.target.value)} required>
            <option value="">Select meal…</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Delivery time" hint="Defaults from grade/teacher rules — override if needed">
          <Select value={deliveryTimeId} onChange={(e) => setDeliveryTimeId(e.target.value)}>
            <option value="">Auto</option>
            {deliveryTimes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reason (optional)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. allergy update, parent request…"
          />
        </Field>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            Save change
          </Button>
        </div>
      </form>
    </Modal>
  );
}
