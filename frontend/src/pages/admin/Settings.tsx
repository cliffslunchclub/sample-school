import { useEffect, useState } from "react";
import { KeyRound, CalendarRange, Copy, Check, Trash2, AlertTriangle, CalendarDays } from "lucide-react";
import pb from "../../lib/pocketbase";
import { Card, Button, Input, Field, Spinner, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { useSemester } from "../../lib/SemesterContext";
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

  const toggleTarget = (key: keyof typeof purgeTargets) =>
    setPurgeTargets((p) => ({ ...p, [key]: !p[key] }));

  const purge = async () => {
    if (!match || !anyChecked) return;
    setPurging(true);
    let deleted = 0;
    try {
      // Order matters: meal_selections before students, teachers last
      if (purgeTargets.orders || purgeTargets.students) {
        const sels = await pb.collection("meal_selections").getFullList({ requestKey: null, fields: "id" });
        for (const r of sels) { await pb.collection("meal_selections").delete(r.id); deleted++; }
      }
      if (purgeTargets.orders) {
        const logs = await pb.collection("audit_log").getFullList({ requestKey: null, fields: "id" });
        for (const r of logs) { await pb.collection("audit_log").delete(r.id); deleted++; }
      }
      if (purgeTargets.students) {
        const stus = await pb.collection("students").getFullList({ requestKey: null, fields: "id" });
        for (const r of stus) { await pb.collection("students").delete(r.id); deleted++; }
      }
      if (purgeTargets.teachers) {
        const tchs = await pb.collection("teachers").getFullList({ requestKey: null, fields: "id" });
        for (const r of tchs) { await pb.collection("teachers").delete(r.id); deleted++; }
      }
      if (purgeTargets.menu) {
        const mnuItems = await pb.collection("menu_items").getFullList({ requestKey: null, fields: "id" });
        for (const r of mnuItems) { await pb.collection("menu_items").delete(r.id); deleted++; }
      }
      setTyped("");
      await loadCounts();
      toast(`Purged ${deleted} record${deleted !== 1 ? "s" : ""} successfully.`);
    } catch {
      await loadCounts();
      toast("Purge failed or partially completed. Check records.", "error");
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

      <Card className="mb-5 p-5">
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
      </Card>

      <Card className="mb-5 p-5">
        <div className="mb-2 flex items-center gap-2 font-extrabold text-ink">
          <CalendarRange className="h-5 w-5 text-leaf-600" /> Lunch schedule &amp; ordering window
        </div>
        <p className="text-sm text-ink-soft">
          Lunch is served every <strong>Monday through Friday</strong> for the semester. Parents can place
          and change selections from <strong>Thursday 12:00&nbsp;AM until Friday 11:59&nbsp;PM</strong> for
          the following week; outside that window their orders are read-only. Administrators can change any
          order at any time.
        </p>
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
