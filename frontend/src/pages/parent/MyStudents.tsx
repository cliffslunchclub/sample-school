import { useEffect, useState } from "react";
import { Plus, GraduationCap, Pencil, User } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { useToast, Button, Card, Field, Input, Select, Modal, EmptyState, Spinner, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { Grade, Teacher, Student } from "../../lib/types";

export default function MyStudents() {
  const { user } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const load = async () => {
    const [st, gr, te] = await Promise.all([
      pb.collection("students").getFullList<Student>({
        filter: `parent = "${user!.id}"`,
        expand: "grade,teacher",
        sort: "name",
        requestKey: null,
      }),
      pb.collection("grades").getFullList<Grade>({ filter: "active = true", sort: "sort_order", requestKey: null }),
      pb.collection("teachers").getFullList<Teacher>({ filter: "active = true", sort: "name", requestKey: null }),
    ]);
    setStudents(st);
    setGrades(gr);
    setTeachers(te);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (s: Student) => {
    setEditing(s);
    setModalOpen(true);
  };

  const onSaved = async () => {
    setModalOpen(false);
    await load();
    toast(editing ? "Student updated" : "Student added");
  };

  if (loading) return <Spinner label="Loading your students…" />;

  return (
    <div>
      <PageHeader
        title="My Students"
        desc="Manage the children linked to your account"
        action={
          <Button onClick={openAdd} size="lg">
            <Plus className="h-5 w-5" /> Add Student
          </Button>
        }
      />

      {students.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" />}
          title="No students yet"
          desc="Add your first child to start selecting their lunches."
          action={
            <Button onClick={openAdd} size="lg">
              <Plus className="h-5 w-5" /> Add Student
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {students.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-ink">{s.name}</p>
                    <p className="text-sm text-ink-soft">
                      {s.expand?.grade?.name} — {s.expand?.teacher?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openEdit(s)}
                  className="rounded-lg p-2 text-ink-faint hover:bg-cream-deep hover:text-ink"
                  aria-label="Edit student"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {!s.active && (
                <div className="mt-3">
                  <Badge tone="red">Inactive</Badge>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Student" : "Add Student"}>
        <StudentForm
          key={editing?.id ?? "new"}
          student={editing}
          grades={grades}
          teachers={teachers}
          parentId={user!.id}
          schoolId={user!.school}
          onSaved={onSaved}
        />
      </Modal>
    </div>
  );
}

function StudentForm({
  student,
  grades,
  teachers,
  parentId,
  schoolId,
  onSaved,
}: {
  student: Student | null;
  grades: Grade[];
  teachers: Teacher[];
  parentId: string;
  schoolId?: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(student?.name ?? "");
  const [grade, setGrade] = useState(student?.grade ?? "");
  const [teacher, setTeacher] = useState(student?.teacher ?? "");
  const [saving, setSaving] = useState(false);

  const filteredTeachers = teachers.filter((t) => t.grade === grade);

  const onGradeChange = (g: string) => {
    setGrade(g);
    // reset teacher if it no longer belongs to the selected grade
    const stillValid = teachers.some((t) => t.grade === g && t.id === teacher);
    if (!stillValid) setTeacher("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grade || !teacher) {
      toast("Please choose a grade and teacher", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, grade, teacher, parent: parentId, active: true, school: schoolId };
      if (student) {
        await pb.collection("students").update(student.id, payload);
      } else {
        await pb.collection("students").create(payload);
      }
      onSaved();
    } catch {
      toast("Could not save student", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Student name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" required />
      </Field>
      <Field label="Grade" required>
        <Select value={grade} onChange={(e) => onGradeChange(e.target.value)} required>
          <option value="">Select grade…</option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Teacher" hint={!grade ? "Choose a grade first" : undefined} required>
        <Select value={teacher} onChange={(e) => setTeacher(e.target.value)} disabled={!grade} required>
          <option value="">{grade ? "Select teacher…" : "Select grade first"}</option>
          {filteredTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-3 pt-2">
        <Button type="submit" size="lg" className="flex-1" loading={saving}>
          {student ? "Save changes" : "Add student"}
        </Button>
      </div>
    </form>
  );
}
