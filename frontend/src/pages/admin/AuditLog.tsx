import { useEffect, useState } from "react";
import { History, ArrowRight } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Spinner, EmptyState, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { formatDate, formatDateTime } from "../../lib/format";
import type { AuditEntry } from "../../lib/types";

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await pb.collection("audit_log").getFullList<AuditEntry>({
        expand: "student,previous_meal,new_meal,admin",
        sort: "-created",
        requestKey: null,
      });
      setEntries(res);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Loading audit history…" />;

  return (
    <div>
      <PageHeader title="Audit Log" desc="Immutable record of administrative meal changes" />

      {entries.length === 0 ? (
        <EmptyState icon={<History className="h-7 w-7" />} title="No changes recorded yet" desc="Admin meal overrides will appear here." />
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
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((a) => (
                  <tr key={a.id} className="hover:bg-leaf-50/40">
                    <td className="px-4 py-3 text-xs text-ink-faint">{formatDateTime(a.created)}</td>
                    <td className="px-4 py-3 font-bold text-ink">{a.expand?.student?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(a.lunch_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{a.expand?.previous_meal?.name ?? "None"}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
                        <Badge tone="green">{a.expand?.new_meal?.name ?? "—"}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {a.expand?.admin?.first_name} {a.expand?.admin?.last_name}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{a.reason || <span className="text-ink-faint">—</span>}</td>
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
