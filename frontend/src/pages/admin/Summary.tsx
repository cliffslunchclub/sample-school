import { WEEKDAYS, type Weekday } from "../../lib/semester";
import { useEffect, useMemo, useState } from "react";
import { Sigma, Printer, Download } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Select, Spinner, EmptyState } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { weekdayOf } from "../../lib/semester";
import { isSampleSite } from "../../lib/site";
import { useSemester } from "../../lib/SemesterContext";
import { toCsv, downloadFile } from "../../lib/csv";
import type { MealSelection as Sel, DeliveryTime } from "../../lib/types";




export default function Summary() {
  const { start, end } = useSemester();
  const recurring = !isSampleSite;
  const [times, setTimes] = useState<DeliveryTime[]>([]);
  const [weekday, setWeekday] = useState<Weekday>("Monday");
  const [orders, setOrders] = useState<Sel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [legacyFallback, setLegacyFallback] = useState(false);

  useEffect(() => {
    (async () => {
      const dt = await pb.collection("delivery_time_slots").getFullList<DeliveryTime>({ filter: "active = true", sort: "sort_order", requestKey: null });
      setTimes(dt);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      setError("");
      try {
        // CHS recurring rows are indexed by weekday. Never build a giant OR
        // expression containing every calendar date in a semester.
        let recurringRows: Sel[] = [];
        if (recurring) {
          recurringRows = await pb.collection("meal_selections").getFullList<Sel>({
            filter: 'recurring_weekday = "Monday"',
            expand: "menu_item,delivery_time",
            requestKey: null,
          });
        }
        let selected = recurringRows;
        let fallback = false;
        if (!recurring || selected.length === 0) {
          // Compatibility for existing CHS imports awaiting migration, and
          // the sample school's historical date-based orders.
          const dated = await pb.collection("meal_selections").getFullList<Sel>({
            filter: `lunch_date >= "${start} 00:00:00.000Z" && lunch_date <= "${end} 23:59:59.999Z"`,
            expand: "menu_item,delivery_time",
            sort: "-lunch_date",
            requestKey: null,
          });
          const matches = dated.filter(o => o.lunch_date && weekdayOf(o.lunch_date.slice(0, 10)) === weekday);
          const newest = matches[0]?.lunch_date.slice(0, 10);
          selected = newest ? matches.filter(o => o.lunch_date.slice(0, 10) === newest) : [];
          fallback = recurring && selected.length > 0;
        }
        if (!cancelled) { setOrders(selected); setLegacyFallback(fallback); }
      } catch {
        if (!cancelled) { setOrders([]); setError("Could not calculate meal totals. Please retry."); }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [weekday, start, end, recurring]);

  const { rows, colTotals, grand } = useMemo(() => {
    const timeIds = times.map((t) => t.id);
    const map = new Map<string, { name: string; counts: Record<string, number>; total: number }>();
    const colTotals: Record<string, number> = {};
    timeIds.forEach((t) => (colTotals[t] = 0));
    let grand = 0;
    orders.forEach((o) => {
      const mid = o.menu_item;
      const name = o.expand?.menu_item?.name ?? "Unknown";
      const tid = o.delivery_time || "none";
      if (!map.has(mid)) map.set(mid, { name, counts: {}, total: 0 });
      const row = map.get(mid)!;
      row.counts[tid] = (row.counts[tid] ?? 0) + 1;
      row.total++;
      colTotals[tid] = (colTotals[tid] ?? 0) + 1;
      grand++;
    });
    const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { rows, colTotals, grand };
  }, [orders, times]);

  const exportCsv = () => {
    const header = ["Menu Item", ...times.map((t) => t.label), "Total"];
    const dataRows = rows.map((r) => [r.name, ...times.map((t) => String(r.counts[t.id] ?? 0)), String(r.total)]);
    const totalRow = ["Total", ...times.map((t) => String(colTotals[t.id] ?? 0)), String(grand)];
    downloadFile(`cliffs-summary-${weekday.toLowerCase()}.csv`, toCsv([header, ...dataRows, totalRow]));
  };

  if (loading) return <Spinner label="Loading summary…" />;

  return (
    <div>
      <PageHeader
        title="Order Summary"
        desc="Automatic meal counts by delivery time"
        action={
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={rows.length === 0} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream-deep disabled:opacity-40">
              <Download className="h-4 w-4" /> CSV
            </button>
            <button onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream-deep">
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        }
      />

      {!recurring && <Card className="mb-4 p-4">
        <div className="max-w-xs">
          <Select value={weekday} onChange={(e) => setWeekday(e.target.value as Weekday)}>
            {WEEKDAYS.map(day => <option key={day} value={day}>{day}</option>)}
          </Select>
        </div>
      </Card>}
      {legacyFallback && <p className="mb-4 text-sm text-amber-700">Showing the latest dated Monday import. These orders have not yet been converted to recurring selections.</p>}
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

      {fetching ? (
        <Spinner label="Calculating…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Sigma className="h-7 w-7" />} title={`No orders for ${weekday}`} desc={recurring ? "No recurring Monday orders yet. Import the new Monday roster." : `No orders for ${weekday} in this semester.`} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/70">
                  <th className="px-4 py-3 font-extrabold text-ink">Menu Item</th>
                  {times.map((t) => (
                    <th key={t.id} className="px-4 py-3 text-center font-extrabold text-ink">{t.label}</th>
                  ))}
                  <th className="px-4 py-3 text-center font-extrabold text-ink">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.name} className="hover:bg-leaf-50/40">
                    <td className="px-4 py-3 font-bold text-ink">{r.name}</td>
                    {times.map((t) => (
                      <td key={t.id} className="px-4 py-3 text-center text-ink-soft">{r.counts[t.id] ?? 0}</td>
                    ))}
                    <td className="px-4 py-3 text-center font-extrabold text-leaf-700">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-cream/70">
                  <td className="px-4 py-3 font-extrabold text-ink">Total</td>
                  {times.map((t) => (
                    <td key={t.id} className="px-4 py-3 text-center font-extrabold text-ink">{colTotals[t.id] ?? 0}</td>
                  ))}
                  <td className="px-4 py-3 text-center font-extrabold text-leaf-700">{grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
