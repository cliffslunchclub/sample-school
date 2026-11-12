import { useEffect, useState } from "react";
import { KeyRound, CalendarRange, Copy, Check, Trash2, AlertTriangle, CalendarDays } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Button, Input, Field, Spinner, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { useSemester } from "../../lib/SemesterContext";
import { isSampleSite } from "../../lib/site";
import { ORDERING_DAYS, DEFAULT_ORDERING_DAYS, orderingDayText, type OrderingDay } from "../../lib/semester";
import { BatchWriteError, sendBatchRequests, type BatchProgress, type BatchRequest } from "../../lib/pocketbaseBatch";
import type { Settings as SettingsType } from "../../lib/types";

const ADJS = ["swift", "calm", "bold", "dark", "iron", "gold", "silver", "brave", "clear", "deep", "bright", "firm"];
const NOUNS = ["river", "harbor", "summit", "bridge", "canyon", "valley", "pillar", "anchor", "compass", "lantern", "tower"];

function genPassphrase(): string {
  const rnd = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${rnd(ADJS)}-${rnd(NOUNS)}-${Math.floor(Math.random() * 9000) + 1000}`;
}

interface Counts { orders: number; students: number; teachers: number; audit: number; menu: number }

export default function Settings() {
  const toast = useToast();
  const semester = useSemester();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [code, setCode] = useState("");
  const [semStart, setSemStart] = useState("");
  const [semEnd, setSemEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSem, setSavingSem] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderingDays, setOrderingDays] = useState<OrderingDay[]>(DEFAULT_ORDERING_DAYS);
  const [savingDays, setSavingDays] = useState(false);

  // Purge state
  const [passphrase] = useState<string>(() => genPassphrase());
  const [typed, setTyped] = useState("");
  const [purging, setPurging] = useState(false);
  const [counts, setCounts] = useState<Counts>({ orders: 0, students: 0, teachers: 0, audit: 0, menu: 0 });
  const [purgeTargets, setPurgeTargets] = useState({ orders: true, students: false, teachers: false, menu: false });

  const match = typed.trim() === passphrase;
  const anyChecked = purgeTargets.orders || purgeTargets.students || purgeTargets.teachers || purgeTargets.menu;

  const loadCounts = async () => {
    const [ord, stu, tch, aud, mnu] = await Promise.all([
      pb.collection("meal_selections").getList(1, 1, { requestKey: null, skipTotal: false }),
      pb.collection("students").getList(1, 1, { requestKey: null, skipTotal: false }),
      pb.collection("teachers").getList(1, 1, { requestKey: null, skipTotal: false }),
      pb.collection("audit_log").getList(1, 1, { requestKey: null, skipTotal: false }),
      pb.collection("menu_items").getList(1, 1, { requestKey: null, skipTotal: false }),
    ]);
    setCounts({ orders: ord.totalItems, students: stu.totalItems, teachers: tch.totalItems, audit: aud.totalItems, menu: mnu.totalItems });
  };

  useEffect(() => {
    (async () => {
      const rec = await pb.collection("settings").getFirstListItem<SettingsType>("id != ''", { requestKey: null });
      setSettings(rec);
      setCode(rec.verification_code);
      setOrderingDays(rec.ordering_days ?? DEFAULT_ORDERING_DAYS);
      setSemStart(rec.semester_start ? rec.semester_start.slice(0, 10) : "");
      setSemEnd(rec.semester_end   ? rec.semester_end.slice(0, 10)   : "");
      await loadCounts();
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await pb.collection("settings").update(settings.id, { verification_code: code });
      toast("Verification code updated");
    } catch {
      toast("Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (semEnd < semStart) { toast("End date must be after start date", "error"); return; }
    setSavingSem(true);
    try {
      await pb.collection("settings").update(settings.id, {
        semester_start: semStart,
        semester_end:   semEnd,
      });
      semester.refresh();
      toast("Semester dates updated");
    } catch {
      toast("Could not save dates", "error");
    } finally {
      setSavingSem(false);
    }
  };

  const saveOrderingDays = async (e: React.FormEvent) => {
    e.preventDefault(); if (!settings) return;
    setSavingDays(true);
    try {
      await pb.collection("settings").update(settings.id, {ordering_days:orderingDays});
      semester.refresh(); toast("Meal selection days updated");
    } catch {toast("Could not save meal selection days", "error");}
    finally {setSavingDays(false);}
  };

  const toggleTarget = (key: keyof typeof purgeTargets) =>
    setPurgeTargets((p) => ({ ...p, [key]: !p[key] }));

  const purge = async () => {
    if (!match || !anyChecked) return;
    setPurging(true);
    const progress: BatchProgress = { count: 0, records: 0 };
    let activeStage = "Preparing purge";
    try {
      const deleteRecords = async (collection: string, label: string) => {
        activeStage = label;
        const records = await pb.collection(collection).getFullList<{ id: string }>({ requestKey: null, fields: "id" });
        const requests: BatchRequest[] = records.map((record) => ({
          method: "DELETE",
          url: `/api/collections/${collection}/records/${record.id}`,
        }));
        await sendBatchRequests(requests, label, progress);
      };

      // Keep dependencies in order: meals first, then students, teachers and menu.
      if (purgeTargets.orders || purgeTargets.students) {
        await deleteRecords("meal_selections", "Meal selections");
      }
      if (purgeTargets.orders) {
        await deleteRecords("audit_log", "Admin audit log");
      }
      if (purgeTargets.students) {
        await deleteRecords("students", "Students");
      }
      if (purgeTargets.teachers) {
        await deleteRecords("teachers", "Teachers");
      }
      if (purgeTargets.menu) {
        await deleteRecords("menu_items", "Menu items");
      }
      setTyped("");
      await loadCounts();
      toast(`Purged ${progress.records || 0} record${progress.records !== 1 ? "s" : ""} successfully.`);
    } catch (error) {
      try { await loadCounts(); } catch { /* Keep the purge error visible if refresh also fails. */ }
      const completed = progress.records || 0;
      const partial = completed ? ` ${completed} records in ${progress.count} batches were deleted before it stopped.` : " No records were confirmed deleted.";
      const stage = error instanceof BatchWriteError ? error.stage : activeStage;
      const detail = error instanceof Error && /Batch requests are not allowed/i.test(error.message)
        ? " Enable PocketBase Batch API in Dashboard → Settings → Application."
        : " Refresh the counts and inspect the selected records before retrying.";
      toast(`Purge stopped during ${stage}.${partial}${detail}`, "error");
    } finally {
      setPurging(false);
    }
  };

  if (loading) return <Spinner label="Loading settings…" />;

  const purgeRows: { key: keyof typeof purgeTargets; label: string; desc: string; count: number }[] = [
    {
      key: "orders",
      label: "Orders & audit log",
      desc: "All meal selections and every audit log entry.",
      count: counts.orders + counts.audit,
    },
    {
      key: "students",
      label: "Students",
      desc: "All student records. Also clears their meal selections.",
      count: counts.students,
    },
    {
      key: "teachers",
      label: "Teachers",
      desc: "All teacher records. Students will lose their teacher assignment.",
      count: counts.teachers,
    },
    {
      key: "menu",
      label: "Menu items",
      desc: "All menu item records. Existing orders referencing them will lose the item name.",
      count: counts.menu,
    },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" desc="School-wide configuration" />

      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-2 font-extrabold text-ink">
          <KeyRound className="h-5 w-5 text-leaf-600" /> Registration verification code
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Parents must enter this code to create an account. Share it only with families at your school.
        </p>
        <form onSubmit={save} className="space-y-4">
          <Field label="Verification code" required>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} required />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-leaf-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </Field>
          <Button type="submit" loading={saving}>Save code</Button>
        </form>
      </Card>

      {isSampleSite && <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-2 font-extrabold text-ink">
          <CalendarDays className="h-5 w-5 text-leaf-600" /> Semester dates
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          All Monday through Friday dates between these dates are treated as lunch days.
          Changing these values takes effect immediately for all pages.
        </p>
        <form onSubmit={saveSemester} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Semester start" required>
              <Input
                type="date"
                value={semStart}
                onChange={(e) => setSemStart(e.target.value)}
                required
              />
            </Field>
            <Field label="Semester end" required>
              <Input
                type="date"
                value={semEnd}
                onChange={(e) => setSemEnd(e.target.value)}
                required
              />
            </Field>
          </div>
          <Button type="submit" loading={savingSem}>Save dates</Button>
        </form>
      </Card>}
      {!isSampleSite && <Card className="mb-5 p-5"><p className="font-extrabold text-ink">Monday-only recurring lunch</p><p className="mt-2 text-sm text-ink-soft">CHS Monday selections repeat every week until changed. Semester dates are not required. Ordering days below control when parents may change meals, not which day lunches are served.</p></Card>}

      <Card className="mb-5 p-5">
        <div className="mb-2 flex items-center gap-2 font-extrabold text-ink">
          <CalendarRange className="h-5 w-5 text-leaf-600" /> Meal selection days
        </div>
        <p className="mb-4 text-sm text-ink-soft">Choose when parents may place or change meals for the following week. Each selected day runs from 12:00 AM to 11:59 PM, Eastern time. Lunch service is {isSampleSite ? "Monday through Friday" : "Monday only"}. Administrators can edit orders at any time.</p>
        <form onSubmit={saveOrderingDays} className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {ORDERING_DAYS.map(day => <label key={day} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={orderingDays.includes(day)} onChange={() => setOrderingDays(days => days.includes(day) ? days.filter(d => d !== day) : [...days, day])} />{day}</label>)}
          </div>
          <p className="text-sm text-ink-soft">{orderingDays.length ? `Selected days: ${orderingDayText(orderingDays)}.` : "No days selected: parent ordering will be closed."}</p>
          <Button type="submit" loading={savingDays}>Save meal selection days</Button>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-tomato-200 p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tomato-50">
            <AlertTriangle className="h-4 w-4 text-tomato-600" />
          </div>
          <div>
            <p className="font-extrabold text-ink">Danger zone</p>
            <p className="text-xs text-ink-faint">These actions cannot be undone</p>
          </div>
        </div>

        {/* What to purge */}
        <p className="mb-2 text-sm font-bold text-ink">Select what to purge</p>
        <div className="mb-5 divide-y divide-line rounded-xl border border-tomato-200 bg-tomato-50/40">
          {purgeRows.map((row) => (
            <label
              key={row.key}
              className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-tomato-50/70"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-tomato-600"
                checked={purgeTargets[row.key]}
                onChange={() => toggleTarget(row.key)}
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink">{row.label}</p>
                <p className="text-xs text-ink-faint">{row.desc}</p>
              </div>
              <span className="rounded-full bg-tomato-100 px-2.5 py-0.5 text-xs font-bold text-tomato-700 shrink-0">
                {row.count}
              </span>
            </label>
          ))}
        </div>

        {/* Passphrase */}
        <div className="rounded-xl bg-cream-deep px-4 py-3 font-mono text-sm font-bold tracking-wide text-ink">
          {passphrase}
        </div>
        <p className="mb-3 mt-1.5 text-xs text-ink-faint">
          Type the passphrase above exactly to unlock the purge button.
        </p>

        <div className="flex gap-3">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type passphrase…"
            className="flex-1 font-mono"
          />
          <Button
            variant="outline"
            className="shrink-0 border-tomato-300 text-tomato-600 hover:bg-tomato-50 disabled:opacity-40"
            disabled={!match || !anyChecked}
            loading={purging}
            onClick={purge}
          >
            <Trash2 className="h-4 w-4" /> Purge
          </Button>
        </div>
      </Card>
    </div>
  );
}
