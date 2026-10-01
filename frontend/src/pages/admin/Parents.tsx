import { useEffect, useMemo, useState, Fragment } from "react";
import { Search, Users2, ChevronDown, ChevronRight } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Input, Spinner, EmptyState, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { formatDate } from "../../lib/format";
import type { UserRecord, Student } from "../../lib/types";

export default function Parents() {
  const toast = useToast();
  const [parents, setParents] = useState<UserRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const [pa, st] = await Promise.all([
      pb.collection("users").getFullList<UserRecord>({ filter: 'role = "parent"', sort: "last_name", requestKey: null }),
      pb.collection("students").getFullList<Student>({ expand: "grade,teacher", sort: "name", requestKey: null }),
    ]);
    setParents(pa);
    setStudents(st);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const byParent = useMemo(() => {
    const map = new Map<string, Student[]>();
    students.forEach((s) => {
      const arr = map.get(s.parent) ?? [];
      arr.push(s);
      map.set(s.parent, arr);
    });
    return map;
  }, [students]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return parents;
    return parents.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(term)
    );
  }, [parents, q]);

  const toggleActive = async (p: UserRecord) => {
    await pb.collection("users").update(p.id, { active: !p.active });
    toast(p.active ? "Account deactivated" : "Account activated");
    load();
  };

  if (loading) return <Spinner label="Loading parents…" />;

  return (
    <div>
      <PageHeader title="Parents" desc={`${parents.length} registered parents`} />

      <Card className="mb-4 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users2 className="h-7 w-7" />} title="No parents found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/70 font-extrabold text-ink">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Students</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((p) => {
                  const kids = byParent.get(p.id) ?? [];
                  const isOpen = expanded === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr className="hover:bg-leaf-50/40">
                        <td className="px-4 py-3">
                          <button onClick={() => setExpanded(isOpen ? null : p.id)} className="inline-flex items-center gap-1.5 font-bold text-ink">
                            {kids.length > 0 ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4" />}
                            {p.first_name} {p.last_name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{p.email}</td>
                        <td className="px-4 py-3 text-center"><Badge>{kids.length}</Badge></td>
                        <td className="px-4 py-3 text-ink-soft">{formatDate(p.created)}</td>
                        <td className="px-4 py-3"><Badge tone={p.active ? "green" : "red"}>{p.active ? "Active" : "Inactive"}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleActive(p)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${p.active ? "text-tomato-600 hover:bg-tomato-50" : "text-leaf-700 hover:bg-leaf-50"}`}
                          >
                            {p.active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                      {isOpen && kids.length > 0 && (
                        <tr className="bg-cream/40">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 pl-6">
                              {kids.map((k) => (
                                <span key={k.id} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
                                  {k.name} · {k.expand?.grade?.name} — {k.expand?.teacher?.name}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
