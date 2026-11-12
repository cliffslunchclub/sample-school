import { useEffect, useState } from "react";
import { Plus, Pencil, Clock, Route, Trash2 } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Button, Input, Select, Field, Modal, Spinner, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { DeliveryTime, DeliveryRule, Grade, Teacher } from "../../lib/types";
import { getTimeUsage, removeDeliveryTime, type TimeUsage } from "../../lib/deleteDeliveryTime";

export default function DeliveryTimes() {
  const toast = useToast();
  const [times, setTimes] = useState<DeliveryTime[]>([]);
  const [rules, setRules] = useState<DeliveryRule[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeModal, setTimeModal] = useState<DeliveryTime | null | undefined>(undefined);
  const [ruleModal, setRuleModal] = useState<DeliveryRule | null | undefined>(undefined);
  const [deleteSlot, setDeleteSlot] = useState<DeliveryTime | null>(null);
  const [usage, setUsage] = useState<TimeUsage | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);

  const load = async () => {
    const [dt, dr, gr, te] = await Promise.all([
      pb.collection("delivery_time_slots").getFullList<DeliveryTime>({ sort: "sort_order", requestKey: null }),
      pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
      pb.collection("grades").getFullList<Grade>({ sort: "sort_order", requestKey: null }),
      pb.collection("teachers").getFullList<Teacher>({ sort: "name", requestKey: null }),
    ]);
    setTimes(dt); setRules(dr); setGrades(gr); setTeachers(te);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const nameOf = (id: string, arr: { id: string; name?: string; label?: string }[]) =>
    arr.find((x) => x.id === id)?.name ?? arr.find((x) => x.id === id)?.label ?? "—";

  const toggleTime = async (t: DeliveryTime) => {
    await pb.collection("delivery_time_slots").update(t.id, { active: !t.active });
    load();
  };
  const deleteRule = async (r: DeliveryRule) => {
    await pb.collection("delivery_rules").delete(r.id);
    toast("Rule removed");
    load();
  };
  const closeDelete = () => {
    if (deleting) return;
    setDeleteSlot(null);
    setUsage(null);
    setReplacementId("");
  };
  const openDelete = async (slot: DeliveryTime) => {
    setDeleteSlot(slot);
    setUsage(null);
    setReplacementId("");
    setCheckingDelete(true);
    try {
      setUsage(await getTimeUsage(slot.id));
    } catch {
      toast("Could not check the time slot's linked records. Try again.", "error");
      setDeleteSlot(null);
    } finally {
      setCheckingDelete(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteSlot || !usage || deleting) return;
    const linked = usage.orders.length + usage.rules.length;
    if (linked && !replacementId) {
      toast("Choose an active replacement time slot first.", "error");
      return;
    }
    setDeleting(true);
    try {
      const result = await removeDeliveryTime(deleteSlot.id, replacementId);
      toast(result.reassignedOrders || result.reassignedRules
        ? `Deleted ${deleteSlot.label}: moved ${result.reassignedOrders} orders and ${result.reassignedRules} rules.`
        : `Deleted ${deleteSlot.label}.`);
      setDeleteSlot(null);
      setUsage(null);
      setReplacementId("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete time slot.", "error");
      try { setUsage(await getTimeUsage(deleteSlot.id)); } catch { setUsage(null); }
    } finally {
      setDeleting(false);
    }
  };
  const deactivateInstead = async () => {
    if (!deleteSlot || deleting) return;
    setDeleting(true);
    try {
      await pb.collection("delivery_time_slots").update(deleteSlot.id, { active: false });
      toast(`Deactivated ${deleteSlot.label}. Its existing order history was preserved.`);
      setDeleteSlot(null);
      setUsage(null);
      await load();
    } catch {
      toast("Could not deactivate this time slot.", "error");
    } finally { setDeleting(false); }
  };

  if (loading) return <Spinner label="Loading…" />;

  return (
    <div>
      <PageHeader title="Delivery Times" desc="Time slots and the grade/teacher rules that assign them" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-ink"><Clock className="h-5 w-5 text-leaf-600" /> Time slots</div>
            <Button size="sm" onClick={() => setTimeModal(null)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="divide-y divide-line">
            {times.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <span className="font-bold text-ink">{t.label}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleTime(t)}><Badge tone={t.active ? "green" : "red"}>{t.active ? "Active" : "Inactive"}</Badge></button>
                  <button onClick={() => setTimeModal(t)} aria-label={`Edit ${t.label}`} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void openDelete(t)} aria-label={`Delete ${t.label}`} title={`Delete ${t.label}`} className="rounded-lg p-1.5 text-ink-faint hover:bg-tomato-50 hover:text-tomato-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {times.length === 0 && <p className="text-sm text-ink-faint">No time slots yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-ink"><Route className="h-5 w-5 text-leaf-600" /> Delivery rules</div>
            <Button size="sm" onClick={() => setRuleModal(null)}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          <p className="mb-3 text-xs text-ink-faint">Meals are auto-assigned a delivery time based on a student's grade (and optionally their teacher).</p>
          <div className="divide-y divide-line">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <div className="text-sm">
                  <span className="font-bold text-ink">{nameOf(r.grade, grades)}</span>
                  {r.teacher && <span className="text-ink-soft"> · {nameOf(r.teacher, teachers)}</span>}
                  <span className="text-ink-faint"> → </span>
                  <Badge tone="sun">{nameOf(r.delivery_time, times)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRuleModal(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => deleteRule(r)} className="rounded-lg p-1.5 text-ink-faint hover:bg-tomato-50 hover:text-tomato-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-ink-faint">No rules yet.</p>}
          </div>
        </Card>
      </div>

      {timeModal !== undefined && (
        <TimeForm slot={timeModal} count={times.length} onClose={() => setTimeModal(undefined)} onSaved={() => { setTimeModal(undefined); load(); toast("Saved"); }} />
      )}
      {ruleModal !== undefined && (
        <RuleForm rule={ruleModal} grades={grades} teachers={teachers} times={times} onClose={() => setRuleModal(undefined)} onSaved={() => { setRuleModal(undefined); load(); toast("Saved"); }} />
      )}
      {deleteSlot && (
        <Modal open onClose={closeDelete} title={`Delete ${deleteSlot.label}?`}>
          {checkingDelete || !usage ? <Spinner label="Checking linked records…" /> : (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft">
                This time slot is assigned to <strong>{usage.orders.length} meal orders</strong> and <strong>{usage.rules.length} delivery rules</strong>.
              </p>
              {usage.orders.length + usage.rules.length === 0 ? (
                <p className="text-sm text-tomato-700">This unused time slot can be deleted permanently. The action cannot be undone.</p>
              ) : (
                <>
                  <Field label="Move linked orders and rules to">
                    <Select value={replacementId} onChange={(e) => setReplacementId(e.target.value)} disabled={deleting}>
                      <option value="">Select an active replacement time…</option>
                      {times.filter(t => t.id !== deleteSlot.id && t.active).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </Select>
                  </Field>
                  <p className="text-sm text-tomato-700">
                    Reassigning will also change the delivery time recorded on <strong>{usage.orders.filter(o => !o.recurring_weekday).length} historical dated orders</strong>.
                    To keep historical delivery times unchanged, choose Deactivate instead.
                  </p>
                </>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDelete} disabled={deleting}>Cancel</Button>
                {usage.orders.length + usage.rules.length > 0 &&
                  <Button type="button" variant="outline" onClick={() => void deactivateInstead()} disabled={deleting}>Deactivate instead</Button>}
                <Button type="button" variant="danger" loading={deleting}
                  disabled={deleting || (usage.orders.length + usage.rules.length > 0 && !replacementId)}
                  onClick={() => void confirmDelete()}>
                  {usage.orders.length + usage.rules.length > 0 ? "Reassign & delete" : "Delete time slot"}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function TimeForm({ slot, count, onClose, onSaved }: { slot: DeliveryTime | null; count: number; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [label, setLabel] = useState(slot?.label ?? "");
  const [order, setOrder] = useState<number>(slot?.sort_order ?? count + 1);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { label, sort_order: Number(order), active: slot?.active ?? true, school: user!.school };
      if (slot) await pb.collection("delivery_time_slots").update(slot.id, payload);
      else await pb.collection("delivery_time_slots").create(payload);
      onSaved();
    } catch { toast("Could not save", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={slot ? "Edit Time Slot" : "Add Time Slot"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label" required><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 12:15" required /></Field>
        <Field label="Sort order"><Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></Field>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function RuleForm({ rule, grades, teachers, times, onClose, onSaved }: {
  rule: DeliveryRule | null; grades: Grade[]; teachers: Teacher[]; times: DeliveryTime[]; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [grade, setGrade] = useState(rule?.grade ?? "");
  const [teacher, setTeacher] = useState(rule?.teacher ?? "");
  const [time, setTime] = useState(rule?.delivery_time ?? "");
  const [saving, setSaving] = useState(false);
  const ft = teachers.filter((t) => t.grade === grade);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade || !time) { toast("Grade and delivery time are required", "error"); return; }
    setSaving(true);
    try {
      const payload = { grade, teacher: teacher || null, delivery_time: time, school: user!.school };
      if (rule) await pb.collection("delivery_rules").update(rule.id, payload);
      else await pb.collection("delivery_rules").create(payload);
      onSaved();
    } catch { toast("Could not save rule", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={rule ? "Edit Rule" : "Add Rule"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Grade" required>
          <Select value={grade} onChange={(e) => { setGrade(e.target.value); setTeacher(""); }} required>
            <option value="">Select grade…</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label="Teacher (optional)" hint="Leave blank to apply to the whole grade">
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} disabled={!grade}>
            <option value="">Whole grade</option>
            {ft.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Delivery time" required>
          <Select value={time} onChange={(e) => setTime(e.target.value)} required>
            <option value="">Select time…</option>
            {times.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
