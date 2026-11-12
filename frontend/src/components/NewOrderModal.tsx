import { useEffect, useMemo, useState } from "react";
import { Modal, Field, Select, Textarea, Button, useToast } from "./ui";
import { adminSetMeal, deriveDeliveryTime } from "../lib/admin";
import { isoForKey, dayFilter, type LunchDate } from "../lib/semester";
import { useAuth } from "../lib/auth";
import pb from "../lib/pocketbase";
import { isSampleSite } from "../lib/site";
import type { Student, MenuItem, DeliveryTime, DeliveryRule, MealSelection } from "../lib/types";

export function NewOrderModal({
  open,
  onClose,
  students,
  menuItems,
  deliveryTimes,
  rules,
  lunchDates,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  students: Student[];
  menuItems: MenuItem[];
  deliveryTimes: DeliveryTime[];
  rules: DeliveryRule[];
  lunchDates: LunchDate[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const recurring = !isSampleSite;

  const [studentId, setStudentId] = useState("");
  const [lunchKey, setLunchKey] = useState(recurring ? "__recurring_monday__" : "");
  const [menuItem, setMenuItem] = useState("");
  const [deliveryTimeId, setDeliveryTimeId] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [conflict, setConflict] = useState<MealSelection | null>(null);
  const [saving, setSaving] = useState(false);

  const student = useMemo(() => students.find((s) => s.id === studentId) ?? null, [students, studentId]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStudentId(""); setLunchKey(recurring ? "__recurring_monday__" : ""); setMenuItem("");
      setDeliveryTimeId(""); setReason(""); setMode("add"); setConflict(null);
    }
  }, [open]);

  // Auto-fill delivery time from rules when student changes
  useEffect(() => {
    if (student) setDeliveryTimeId(deriveDeliveryTime(student, rules));
  }, [student, rules]);

  // Check for an existing selection whenever student + date both have a value
  useEffect(() => {
    if (!studentId || !lunchKey) { setConflict(null); return; }
    let cancelled = false;
    pb.collection("meal_selections")
      .getFirstListItem<MealSelection>(
        recurring ? `student = "${studentId}" && recurring_weekday = "Monday"` : `student = "${studentId}" && ${dayFilter("lunch_date", lunchKey)}`,
        { requestKey: null }
      )
      .then((sel) => { if (!cancelled) setConflict(sel); })
      .catch(() => { if (!cancelled) setConflict(null); });
    return () => { cancelled = true; };
  }, [studentId, lunchKey, recurring]);

  const conflictMealName = conflict
    ? (menuItems.find((m) => m.id === conflict.menu_item)?.name ?? "existing meal")
    : null;

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => {
      const ga = a.expand?.grade?.name ?? "";
      const gb = b.expand?.grade?.name ?? "";
      return ga !== gb ? ga.localeCompare(gb) : a.name.localeCompare(b.name);
    }),
    [students]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !lunchKey || !menuItem) {
      toast("Select a student, day and meal", "error");
      return;
    }
    setSaving(true);
    try {
      if (conflict && mode === "add") {
        // Create alongside the existing record (second lunch same day)
        await pb.collection("meal_selections").create({
          student: student.id,
          lunch_date: recurring ? "" : isoForKey(lunchKey),
          recurring_weekday: recurring ? "Monday" : "",
          menu_item: menuItem,
          delivery_time: deliveryTimeId || deriveDeliveryTime(student, rules) || null,
          parent: student.parent || null,
          school: user!.school,
        });
        await pb.collection("audit_log").create({
          student: student.id,
          lunch_date: recurring ? "" : isoForKey(lunchKey),
          recurring_weekday: recurring ? "Monday" : "",
          previous_meal: conflict.menu_item || null,
          new_meal: menuItem,
          admin: user!.id,
          action: "meal_add_additional",
          reason,
          school: user!.school,
        });
      } else {
        // Create or replace via the standard admin path
        await adminSetMeal({
          student,
          lunchKey,
          recurringWeekday: recurring ? "Monday" : undefined,
          newMenuItem: menuItem,
          deliveryTimeId,
          reason,
          adminId: user!.id,
          schoolId: user!.school,
          rules,
        });
      }
      toast("Order saved");
      onSaved();
    } catch {
      toast("Could not save the order", "error");
    } finally {
      setSaving(false);
    }
  };

  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const upcomingDates = lunchDates.filter(d => d.key >= today);

  return (
    <Modal open={open} onClose={onClose} title="New order">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student" required>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">Select student…</option>
            {sortedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.expand?.grade?.name ? ` — ${s.expand.grade.name}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Day" required>
          {recurring ? <div className="flex h-11 items-center rounded-xl border border-line bg-cream-deep px-4 text-sm font-bold">Monday · repeats every week</div> : <Select value={lunchKey} onChange={(e) => setLunchKey(e.target.value)} required>
            <option value="">Select day…</option>
            {upcomingDates.map(d => <option key={d.key} value={d.key}>{d.weekday} · {d.key}</option>)}
          </Select>}
        </Field>

        {/* Conflict resolution — only shown when an order already exists */}
        {conflict && (
          <div className="rounded-xl border border-sun-300 bg-sun-50/70 p-3.5">
            <p className="mb-2.5 text-sm text-[oklch(0.45_0.12_65)]">
              This student already has <strong>{conflictMealName}</strong> on this {recurring ? "weekday" : "date"}.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("add")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === "add" ? "bg-sun-400 text-white" : "border border-line bg-white text-ink-soft hover:bg-cream-deep"
                }`}
              >
                Add alongside
              </button>
              <button
                type="button"
                onClick={() => setMode("replace")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  mode === "replace" ? "bg-tomato-500 text-white" : "border border-line bg-white text-ink-soft hover:bg-cream-deep"
                }`}
              >
                Replace existing
              </button>
            </div>
          </div>
        )}

        <Field label="Menu item" required>
          <Select value={menuItem} onChange={(e) => setMenuItem(e.target.value)} required>
            <option value="">Select meal…</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Delivery time" hint="Auto-filled from grade/teacher rules — override if needed">
          <Select value={deliveryTimeId} onChange={(e) => setDeliveryTimeId(e.target.value)}>
            <option value="">Auto</option>
            {deliveryTimes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Reason (optional)">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. parent request, event order…"
          />
        </Field>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save order</Button>
        </div>
      </form>
    </Modal>
  );
}
