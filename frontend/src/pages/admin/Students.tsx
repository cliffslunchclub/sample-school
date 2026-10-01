import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Utensils, ClipboardList, GraduationCap, Plus } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Input, Select, Spinner, EmptyState, Button, Modal, Field, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { MealOverrideModal } from "../../components/MealOverrideModal";
import { formatDate } from "../../lib/format";
import { lunchDates } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import type {
  Student, Grade, Teacher, MenuItem, DeliveryTime, DeliveryRule, MealSelection as Sel,
} from "../../lib/types";

export default function AdminStudents() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [times, setTimes] = useState<DeliveryTime[]>([]);
  const [rules, setRules] = useState<DeliveryRule[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end } = useSemester();
  const days = useMemo(() => lunchDates(start, end), [start, end]);

  const [q, setQ] = useState("");
  const [fGrade, setFGrade] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [override, setOverride] = useState<Student | null>(null);
  const [viewOrders, setViewOrders] = useState<Student | null>(null);

  const load = async () => {
    const [st, gr, te, mi, dt, dr] = await Promise.all([
      pb.collection("students").getFullList<Student>({ expand: "grade,teacher,parent", sort: "name", requestKey: null }),
      pb.collection("grades").getFullList<Grade>({ sort: "sort_order", requestKey: null }),
      pb.collection("teachers").getFullList<Teacher>({ sort: "name", requestKey: null }),
      pb.collection("menu_items").getFullList<MenuItem>({ filter: "active = true", sort: "name", requestKey: null }),
      pb.collection("delivery_time_slots").getFullList<DeliveryTime>({ sort: "sort_order", requestKey: null }),
      pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
    ]);
    setStudents(st); setGrades(gr); setTeachers(te); setMenu(mi); setTimes(dt); setRules(dr);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return students.filter((s) => {
      if (fGrade && s.grade !== fGrade) return false;
      if (term) {
        const hay = `${s.name} ${s.expand?.parent?.first_name ?? ""} ${s.expand?.parent?.last_name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [students, q, fGrade]);

  const toggleActive = async (s: Student) => {
    await pb.collection("students").update(s.id, { active: !s.active });
    toast(s.active ? "Student deactivated" : "Student activated");
    load();
  };

  if (loading) return <Spinner label="Loading students…" />;

  return (
    <div>
      <PageHeader
        title="Students"
        desc={`${filtered.length} of ${students.length} students`}
        action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add student</Button>}
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student or parent…" className="pl-9" />
          </div>
          <Select value={fGrade} onChange={(e) => setFGrade(e.target.value)} className="sm:w-52">
            <option value="">All grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<GraduationCap className="h-7 w-7" />} title="No students found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/70 font-extrabold text-ink">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-leaf-50/40">
                    <td className="px-4 py-3 font-bold text-ink">{s.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.expand?.grade?.name}</td>
                    <td className="px-4 py-3 text-ink-soft">{s.expand?.teacher?.name}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {s.expand?.parent?.first_name} {s.expand?.parent?.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(s)}>
                        <Badge tone={s.active ? "green" : "red"}>{s.active ? "Active" : "Inactive"}</Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewOrders(s)} className="rounded-lg p-2 text-ink-faint hover:bg-cream-deep hover:text-ink" title="View orders">
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        <button onClick={() => setOverride(s)} className="rounded-lg p-2 text-ink-faint hover:bg-cream-deep hover:text-tomato-600" title="Change meal">
                          <Utensils className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-ink-faint hover:bg-cream-deep hover:text-leaf-700" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding && (
        <AddStudent
          grades={grades}
          teachers={teachers}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); toast("Student added"); }}
        />
      )}

      {editing && (
        <EditStudent
          student={editing}
          grades={grades}
          teachers={teachers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); toast("Student updated"); }}
        />
      )}

      <MealOverrideModal
        open={!!override}
        onClose={() => setOverride(null)}
        student={override}
        lunchDates={days}
        menuItems={menu}
        deliveryTimes={times}
        rules={rules}
        onSaved={() => { setOverride(null); toast("Meal updated"); }}
      />

      {viewOrders && <StudentOrders student={viewOrders} onClose={() => setViewOrders(null)} />}
    </div>
  );
}

function AddStudent({
  grades, teachers, onClose, onSaved,
}: {
  grades: Grade[]; teachers: Teacher[]; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacher, setTeacher] = useState("");
  const [saving, setSaving] = useState(false);
  const ft = teachers.filter((t) => t.grade === grade);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) { toast("Select a grade", "error"); return; }
    if (!teacher) { toast("Select a teacher", "error"); return; }
    setSaving(true);
    try {
      await pb.collection("students").create({
        name: name.trim(),
        grade,
        teacher,
        active: true,
        school: user!.school,
      });
      onSaved();
    } catch { toast("Could not add student", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Add Student">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emma Chen"
            required
          />
        </Field>
        <Field label="Grade" required>
          <Select value={grade} onChange={(e) => { setGrade(e.target.value); setTeacher(""); }} required>
            <option value="">Select grade…</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label="Teacher" required>
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} required disabled={!grade}>
            <option value="">{grade ? "Select teacher…" : "Choose a grade first"}</option>
            {ft.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <p className="text-xs text-ink-faint">
          Parent can be linked later by the parent signing up and verifying, or by editing the student.
        </p>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Add student</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditStudent({
  student, grades, teachers, onClose, onSaved,
}: {
  student: Student; grades: Grade[]; teachers: Teacher[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(student.name);
  const [grade, setGrade] = useState(student.grade);
  const [teacher, setTeacher] = useState(student.teacher);
  const [saving, setSaving] = useState(false);
  const ft = teachers.filter((t) => t.grade === grade);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) { toast("Choose a teacher", "error"); return; }
    setSaving(true);
    try {
      await pb.collection("students").update(student.id, { name, grade, teacher });
      onSaved();
    } catch { toast("Could not save", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Edit Student">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Grade" required>
          <Select value={grade} onChange={(e) => { setGrade(e.target.value); setTeacher(""); }} required>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label="Teacher" required>
          <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} required>
            <option value="">Select teacher…</option>
            {ft.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

function StudentOrders({ student, onClose }: { student: Student; onClose: () => void }) {
  const [orders, setOrders] = useState<Sel[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await pb.collection("meal_selections").getFullList<Sel>({
        filter: `student = "${student.id}"`,
        expand: "menu_item,delivery_time",
        sort: "-lunch_date",
        requestKey: null,
      });
      setOrders(res);
      setLoading(false);
    })();
  }, [student.id]);

  return (
    <Modal open onClose={onClose} title={`Orders — ${student.name}`}>
      {loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">No orders yet.</p>
      ) : (
        <div className="divide-y divide-line">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-bold text-ink">{formatDate(o.lunch_date)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink">{o.expand?.menu_item?.name}</p>
                <p className="text-xs text-ink-faint">{o.expand?.delivery_time?.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
