import { useEffect, useState } from "react";
import { History, ArrowRight } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Spinner, EmptyState, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { formatDate, formatDateTime } from "../../lib/format";
import type { AuditEntry } from "../../lib/types";

export default function AuditLog({parent = false}: {parent?: boolean}) {
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setError(""); setEntries([]);
    (async () => {
      try {
      const res = await pb.collection(parent ? "parent_audit_log" : "audit_log").getFullList<AuditEntry>({
        expand: parent ? "student,previous_meal,new_meal,actor" : "student,previous_meal,new_meal,admin",
        sort: "-created",
        requestKey: null,
      });
      setEntries(res);
      } catch { setError("Could not load audit history. Please refresh."); }
      finally { setLoading(false); }
    })();
  }, [parent]);

  if (loading) return <Spinner label="Loading audit history…" />;

  return (
    <div>
      <PageHeader title={parent ? "Parent Audit Log" : "Admin Audit Logs"} desc={parent ? "History of meal selections created or changed by parents" : "Immutable record of administrative meal changes"} />
      {error && <p role="alert" className="mb-4 text-tomato-600">{error}</p>}

      {entries.length === 0 ? (
        <EmptyState icon={<History className="h-7 w-7" />} title="No changes recorded yet" desc={parent ? "Parent meal selections and changes will appear here." : "Admin meal overrides will appear here."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/70 font-extrabold text-ink">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Lunch date</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">{parent ? "Parent" : "Admin"}</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((a) => (
                  <tr key={a.id} className="hover:bg-leaf-50/40">
                    <td className="px-4 py-3 text-xs text-ink-faint">{formatDateTime(a.created)}</td>
                    <td className="px-4 py-3 font-bold text-ink">{a.student_name || a.expand?.student?.name || "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(a.lunch_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{a.previous_meal_name || a.expand?.previous_meal?.name || "None"}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
                        <Badge tone="green">{a.new_meal_name || a.expand?.new_meal?.name || "—"}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {parent ? (a.actor_name || `${a.expand?.actor?.first_name || ""} ${a.expand?.actor?.last_name || ""}`) : `${a.expand?.admin?.first_name || ""} ${a.expand?.admin?.last_name || ""}`}
                      {parent && <p className="text-xs text-ink-faint">{a.actor_email}</p>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{parent ? a.action.replace(/_/g, " ") : a.reason || <span className="text-ink-faint">—</span>}
                      {parent && a.previous_delivery_time !== a.new_delivery_time && <p className="text-xs">Time: {a.previous_delivery_time || "None"} → {a.new_delivery_time || "None"}</p>}
                      {parent && a.previous_lunch_date && a.previous_lunch_date !== a.lunch_date && <p className="text-xs">Date: {formatDate(a.previous_lunch_date)} → {formatDate(a.lunch_date)}</p>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
