import { useEffect, useState } from "react";
import { Plus, Pencil, School, Users, Trash2, AlertTriangle } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Button, Input, Select, Field, Modal, Spinner, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { Grade, Teacher } from "../../lib/types";

export default function GradesTeachers() {
  const toast = useToast();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeModal, setGradeModal] = useState<Grade | null | undefined>(undefined);
  const [teacherModal, setTeacherModal] = useState<Teacher | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "grade" | "teacher"; item: Grade | Teacher } | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<"grades" | "teachers" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const [gr, te] = await Promise.all([
      pb.collection("grades").getFullList<Grade>({ sort: "sort_order", requestKey: null }),
      pb.collection("teachers").getFullList<Teacher>({ sort: "name", requestKey: null }),
    ]);
    setGrades(gr);
    setTeachers(te);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleGrade = async (g: Grade) => {
    await pb.collection("grades").update(g.id, { active: !g.active });
    load();
  };
  const toggleTeacher = async (t: Teacher) => {
    await pb.collection("teachers").update(t.id, { active: !t.active });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const col = deleteTarget.type === "grade" ? "grades" : "teachers";
      await pb.collection(col).delete(deleteTarget.item.id);
      toast(`${deleteTarget.type === "grade" ? "Grade" : "Teacher"} deleted`);
      setDeleteTarget(null);
      load();
    } catch {
      toast("Could not delete — it may still have linked records", "error");
    } finally {
      setDeleting(false);
    }
  };

  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setDeleting(true);
    try {
      const col = purgeTarget === "grades" ? "grades" : "teachers";
      const all = purgeTarget === "grades" ? grades : teachers;
      await Promise.all(all.map((item) => pb.collection(col).delete(item.id)));
      toast(`All ${purgeTarget} deleted`);
      setPurgeTarget(null);
      load();
    } catch {
      toast("Some records could not be deleted — they may have linked data", "error");
      setPurgeTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner label="Loading…" />;

  return (
    <div>
      <PageHeader title="Grades & Teachers" desc="Configure grades and the teachers within them" />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Grades */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-ink">
              <School className="h-5 w-5 text-leaf-600" /> Grades
            </div>
            <div className="flex items-center gap-2">
              {grades.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPurgeTarget("grades")}
                  className="text-tomato-600 hover:bg-tomato-50">
                  <Trash2 className="h-3.5 w-3.5" /> Purge all
                </Button>
              )}
              <Button size="sm" onClick={() => setGradeModal(null)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </div>
          <div className="divide-y divide-line">
            {grades.length === 0 && <p className="py-4 text-sm text-ink-faint">No grades yet.</p>}
            {grades.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2.5">
                <span className="font-bold text-ink">{g.name}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleGrade(g)}>
                    <Badge tone={g.active ? "green" : "red"}>{g.active ? "Active" : "Inactive"}</Badge>
                  </button>
                  <button onClick={() => setGradeModal(g)}
                    className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: "grade", item: g })}
                    className="rounded-lg p-1.5 text-ink-faint hover:bg-tomato-50 hover:text-tomato-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Teachers */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-extrabold text-ink">
              <Users className="h-5 w-5 text-leaf-600" /> Teachers
            </div>
            <div className="flex items-center gap-2">
              {teachers.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPurgeTarget("teachers")}
                  className="text-tomato-600 hover:bg-tomato-50">
                  <Trash2 className="h-3.5 w-3.5" /> Purge all
                </Button>
              )}
              <Button size="sm" onClick={() => setTeacherModal(null)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </div>
          <div className="space-y-4">
            {grades.map((g) => {
              const list = teachers.filter((t) => t.grade === g.id);
              if (list.length === 0) return null;
              return (
                <div key={g.id}>
                  <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-ink-faint">{g.name}</p>
                  <div className="divide-y divide-line">
                    {list.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2">
                        <span className="font-bold text-ink">{t.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleTeacher(t)}>
                            <Badge tone={t.active ? "green" : "red"}>{t.active ? "Active" : "Inactive"}</Badge>
                          </button>
                          <button onClick={() => setTeacherModal(t)}
                            className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: "teacher", item: t })}
                            className="rounded-lg p-1.5 text-ink-faint hover:bg-tomato-50 hover:text-tomato-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {teachers.length === 0 && <p className="text-sm text-ink-faint">No teachers yet.</p>}
          </div>
        </Card>
      </div>

      {/* Grade / Teacher modals */}
      {gradeModal !== undefined && (
        <GradeForm
          grade={gradeModal}
          count={grades.length}
          onClose={() => setGradeModal(undefined)}
          onSaved={() => { setGradeModal(undefined); load(); toast("Grade saved"); }}
        />
      )}
      {teacherModal !== undefined && (
        <TeacherForm
          teacher={teacherModal}
          grades={grades}
          onClose={() => setTeacherModal(undefined)}
          onSaved={() => { setTeacherModal(undefined); load(); toast("Teacher saved"); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal open onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget.type}`}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-tomato-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tomato-600" />
              <p className="text-sm text-tomato-800">
                Delete <strong>{deleteTarget.item.name}</strong>? This cannot be undone.
                If linked records (students, meal orders) exist the delete will be blocked.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="flex-1 bg-tomato-600 hover:bg-tomato-700" loading={deleting} onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Purge confirmation */}
      {purgeTarget && (
        <Modal open onClose={() => setPurgeTarget(null)} title={`Purge all ${purgeTarget}`}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-tomato-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tomato-600" />
              <p className="text-sm text-tomato-800">
                This will permanently delete <strong>all {purgeTarget === "grades" ? grades.length : teachers.length} {purgeTarget}</strong>.
                Records linked to students or orders cannot be deleted and will be skipped with an error.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPurgeTarget(null)}>Cancel</Button>
              <Button className="flex-1 bg-tomato-600 hover:bg-tomato-700" loading={deleting} onClick={confirmPurge}>
                Purge all {purgeTarget}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GradeForm({ grade, count, onClose, onSaved }: {
  grade: Grade | null; count: number; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(grade?.name ?? "");
  const [order, setOrder] = useState<number>(grade?.sort_order ?? count + 1);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, sort_order: Number(order), active: grade?.active ?? true, school: user!.school };
      if (grade) await pb.collection("grades").update(grade.id, payload);
      else await pb.collection("grades").create(payload);
      onSaved();
    } catch { toast("Could not save grade", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={grade ? "Edit Grade" : "Add Grade"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Grade name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 6" required />
        </Field>
        <Field label="Sort order">
          <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function TeacherForm({ teacher, grades, onClose, onSaved }: {
  teacher: Teacher | null; grades: Grade[]; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(teacher?.name ?? "");
  const [grade, setGrade] = useState(teacher?.grade ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade) { toast("Choose a grade", "error"); return; }
    setSaving(true);
    try {
      const payload = { name, grade, active: teacher?.active ?? true, school: user!.school };
      if (teacher) await pb.collection("teachers").update(teacher.id, payload);
      else await pb.collection("teachers").create(payload);
      onSaved();
    } catch { toast("Could not save teacher", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={teacher ? "Edit Teacher" : "Add Teacher"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Teacher name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DelPriore" required />
        </Field>
        <Field label="Grade" required>
          <Select value={grade} onChange={(e) => setGrade(e.target.value)} required>
            <option value="">Select grade…</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
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
