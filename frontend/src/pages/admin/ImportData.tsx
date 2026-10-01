import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, CheckCircle2, AlertTriangle, XCircle,
  ArrowRight, ArrowLeft, FileSpreadsheet, History, RefreshCw,
  Download, Copy, Check, ChevronDown, ChevronUp,
} from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Button, Select, Spinner, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { formatDateTime } from "../../lib/format";
import { guessColumn, toCsv, downloadFile } from "../../lib/csv";
import { WEEKDAYS, lunchDates } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import type { MenuItem } from "../../lib/types";
import {
  COMBINED_FIELDS, loadRefData, analyzeCombined,
  type Mapping, type RefData, type AnalyzedRow, type CombinedStats,
} from "../../lib/importAnalyze";
import { executeCombined, type ExecResult } from "../../lib/importExecute";

type Step = "upload" | "map" | "preview" | "result";
type Parsed = { headers: string[]; rows: string[][] };
type Analysis = { rows: AnalyzedRow[]; stats: CombinedStats };

interface HistoryRec {
  id: string; filename: string; import_type: string; rows_processed: number;
  rows_imported: number; rows_skipped: number; rows_errors: number; created: string;
  expand?: { admin?: { first_name: string; last_name: string } };
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload",  label: "Upload"  },
  { key: "map",     label: "Map"     },
  { key: "preview", label: "Preview" },
  { key: "result",  label: "Done"    },
];

const TEMPLATE_ROWS = [
  ["Student Name", "Grade", "Teacher", "Delivery Time", "Monday Meal", "Tuesday Meal", "Wednesday Meal", "Thursday Meal", "Friday Meal"],
  ["John Smith",   "Grade 3",      "DelPriore", "11:45", "Chicken Teriyaki Bowl", "Chicken Alfredo Pasta", "Bulgogi Beef Bowl", "Chicken Fried Rice", "Chicken Nuggets + TT"],
  ["Jane Smith",   "Grade 1",      "Carter",    "10:45", "Cheeseburger Sliders + TT", "Chicken Nuggets + TT", "Chicken Quesadilla", "Chicken Fried Rice", "Grilled Cheese + TT"],
  ["Jordan Smith", "Kindergarten", "Anderson",  "10:45", "Chicken Nuggets + TT", "Chicken Fried Rice", "Grilled Cheese + TT", "Chicken Quesadilla", "Chicken Teriyaki Bowl"],
];

export default function ImportData() {
  const { user } = useAuth();
  const toast = useToast();
  const { start, end } = useSemester();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<Step>("upload");
  const [filename, setFilename]   = useState("");
  const [parsed, setParsed]       = useState<Parsed | null>(null);
  const [mapping, setMapping]     = useState<Mapping>({});
  const [ref, setRef]             = useState<RefData | null>(null);
  const [analysis, setAnalysis]   = useState<Analysis | null>(null);
  const [result, setResult]       = useState<ExecResult | null>(null);
  const [busy, setBusy]           = useState(false);
  const [history, setHistory]     = useState<HistoryRec[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [issuesOnly, setIssuesOnly] = useState(false);

  // Auto-resolve: next upcoming Monday in the semester (no user selection needed)
  const mondayKey = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return lunchDates(start, end).find((d) => d.weekday === "Monday" && d.key >= todayKey)?.key ?? "";
  }, [start, end]);

  // Wednesday is always Monday + 2
  const wednesdayKey = useMemo(() => {
    if (!mondayKey) return "";
    const d = new Date(`${mondayKey}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 2);
    const key = d.toISOString().slice(0, 10);
    return key <= end ? key : "";
  }, [mondayKey, end]);

  const extraKeys = useMemo(() => Object.fromEntries([['tuesday', 1], ['thursday', 3], ['friday', 4]].map(([day, offset]) => {
    if (!mondayKey) return [day, ""];
    const d = new Date(`${mondayKey}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(offset));
    const key = d.toISOString().slice(0, 10);
    return [day, key <= end ? key : ""];
  })), [mondayKey, end]);

  // Load menu items on mount so they're visible before uploading
  useEffect(() => {
    pb.collection("menu_items").getFullList<MenuItem>({
      filter: "active = true", sort: "name", requestKey: null,
    }).then(setMenuItems).catch(() => {});
  }, []);

  const loadHistory = async () => {
    const h = await pb.collection("import_history").getFullList<HistoryRec>({
      expand: "admin", sort: "-created", requestKey: null,
    });
    setHistory(h);
  };
  useEffect(() => { loadHistory(); }, []);

  const reset = () => {
    setStep("upload"); setFilename(""); setParsed(null);
    setMapping({}); setAnalysis(null); setResult(null); setIssuesOnly(false);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch(`${pb.baseURL}/api/import/parse-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
        body: JSON.stringify({ csv: text, type: "combined" }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.message || "Could not read file", "error"); return; }
      const p: Parsed = { headers: data.headers, rows: data.rows };
      setParsed(p);
      setFilename(file.name);
      const map: Mapping = {};
      COMBINED_FIELDS.forEach((f) => { map[f.key] = guessColumn(p.headers, f.keywords); });
      setMapping(map);
      const refData = await loadRefData();
      setRef(refData);
      setStep("map");
    } catch {
      toast("Could not read the file", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const mappingValid = useMemo(() => {
    const has = (k: string) => (mapping[k] ?? -1) >= 0;
    if (!has("student_name")) return false;
    return has("grade") || has("teacher") || has("grade_teacher");
  }, [mapping]);

  const runAnalyze = () => {
    if (!parsed || !ref) return;
    const a = analyzeCombined(parsed.rows, mapping, ref, mondayKey, wednesdayKey, extraKeys);
    setAnalysis(a);
    setIssuesOnly(false);
    setStep("preview");
  };

  const setMondayResolution = (line: number, val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.line === line ? { ...r, mondayResolution: val } : r) } : a);
  const setTuesdayResolution = (line: number, val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.line === line ? { ...r, tuesdayResolution: val } : r) } : a);
  const setThursdayResolution = (line: number, val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.line === line ? { ...r, thursdayResolution: val } : r) } : a);
  const setFridayResolution = (line: number, val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.line === line ? { ...r, fridayResolution: val } : r) } : a);
  const setWednesdayResolution = (line: number, val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.line === line ? { ...r, wednesdayResolution: val } : r) } : a);
  const setAllMonday = (val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.mondayConflict ? { ...r, mondayResolution: val } : r) } : a);
  const setAllTuesday = (val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.tuesdayConflict ? { ...r, tuesdayResolution: val } : r) } : a);
  const setAllThursday = (val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.thursdayConflict ? { ...r, thursdayResolution: val } : r) } : a);
  const setAllFriday = (val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.fridayConflict ? { ...r, fridayResolution: val } : r) } : a);
  const setAllWednesday = (val: "keep" | "replace" | "add") =>
    setAnalysis((a) => a ? { ...a, rows: a.rows.map((r) => r.wednesdayConflict ? { ...r, wednesdayResolution: val } : r) } : a);

  const confirmImport = async () => {
    if (!analysis || !ref) return;
    setBusy(true);
    try {
      const r = await executeCombined(analysis.rows, ref, mondayKey, wednesdayKey, { schoolId: user!.school }, extraKeys);
      await pb.collection("import_history").create({
        filename,
        import_type: "combined",
        admin: user!.id,
        rows_processed: analysis.stats.total,
        rows_imported: r.imported,
        rows_skipped: r.skipped,
        rows_errors: r.errors,
        summary: `${r.createdStudents} students, ${r.createdMeals} meals created, ${r.replacedMeals} replaced`,
        school: user!.school,
      });
      setResult(r);
      setStep("result");
      loadHistory();
    } catch {
      toast("Import failed. No further changes were saved.", "error");
    } finally {
      setBusy(false);
    }
  };

  const activeIdx = STEPS.findIndex((s) => s.key === step);

  const flagged = analysis?.rows.filter(
    (r) => r.status === "error" || r.status === "duplicate" || r.mondayConflict || r.wednesdayConflict || r.tuesdayConflict || r.thursdayConflict || r.fridayConflict
      || (r.mondayMenuName && !r.mondayMenuMatched) || (r.wednesdayMenuName && !r.wednesdayMenuMatched) || (r.tuesdayMenuName && !r.tuesdayMenuMatched) || (r.thursdayMenuName && !r.thursdayMenuMatched) || (r.fridayMenuName && !r.fridayMenuMatched)
  ) ?? [];

  const previewRows = issuesOnly ? flagged : (analysis?.rows ?? []);

  return (
    <div>
      <PageHeader
        title="Import Data"
        desc="Bring class rosters and meal orders into Cliffs Lunch Club in one file"
        action={step !== "upload" && <Button variant="outline" onClick={reset}><RefreshCw className="h-4 w-4" /> Start over</Button>}
      />

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto thin-scroll">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
              i === activeIdx ? "bg-leaf-600 text-white" : i < activeIdx ? "bg-leaf-100 text-leaf-700" : "bg-cream-deep text-ink-faint"
            }`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-xs">{i + 1}</span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />}
          </div>
        ))}
      </div>

      {busy && step !== "preview" && <Spinner label="Working…" />}

      {/* STEP: UPLOAD */}
      {step === "upload" && !busy && (
        <>
          <Card className="p-6">
            {/* Drop zone */}
            <div
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-cream/50 px-6 py-12 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <p className="text-lg font-extrabold text-ink">Upload your CSV</p>
              <p className="mt-1 max-w-md text-sm text-ink-soft">
                Drag & drop a .csv file here, or choose one. Nothing is saved until you confirm.
              </p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              <Button className="mt-5" size="lg" onClick={() => fileRef.current?.click()}>
                <Upload className="h-5 w-5" /> Choose CSV file
              </Button>
              <button
                onClick={() => downloadFile("cliffs-import-template.csv", toCsv(TEMPLATE_ROWS))}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-leaf-700 hover:underline"
              >
                <Download className="h-4 w-4" /> Download template
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-cream/60 px-4 py-3 text-xs text-ink-soft">
              <strong className="text-ink">Template columns:</strong>{" "}
              Student Name · Grade · Teacher · Delivery Time · Monday through Friday Meal columns.
              Leave any day's Meal column blank to skip that day's order.
            </div>
          </Card>

          <MenuReference items={menuItems} />
          <ImportHistory history={history} />
        </>
      )}

      {/* STEP: MAP */}
      {step === "map" && parsed && !busy && (
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-1 text-lg font-extrabold text-ink">Map your columns</h3>
            <p className="mb-4 text-sm text-ink-soft">
              Match each CSV column to a Cliffs Lunch Club field.
              Detected <strong>{parsed.rows.length}</strong> data rows in <strong>{filename}</strong>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMBINED_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {f.label}{f.required && <span className="text-tomato-500"> *</span>}
                    </p>
                    <p className="text-xs text-ink-faint">Field</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  <Select
                    value={String(mapping[f.key] ?? -1)}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                    className="w-40 shrink-0"
                  >
                    <option value="-1">— Not mapped —</option>
                    {parsed.headers.map((h, idx) => <option key={idx} value={idx}>{h || `Column ${idx + 1}`}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Tip: if one column holds both grade and teacher (e.g. <strong>3-DelPriore</strong>), map it to "Grade/Teacher (combined)".
            </p>
          </Card>

          {/* Raw preview */}
          <Card className="overflow-hidden">
            <div className="border-b border-line bg-cream/60 px-5 py-3 text-sm font-extrabold text-ink">
              CSV preview (first {Math.min(8, parsed.rows.length)} rows)
            </div>
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-white">
                    {parsed.headers.map((h, i) => <th key={i} className="px-3 py-2 font-bold text-ink-soft">{h || `Col ${i + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.rows.slice(0, 8).map((r, i) => (
                    <tr key={i}>{parsed.headers.map((_, j) => <td key={j} className="px-3 py-2 text-ink-soft">{r[j]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <MenuReference items={menuItems} />

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep("upload")}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <Button size="lg" disabled={!mappingValid} onClick={runAnalyze}>
              Analyze data <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          {!mappingValid && <p className="text-right text-xs text-tomato-600">Map all required (*) fields to continue.</p>}
        </div>
      )}

      {/* STEP: PREVIEW */}
      {step === "preview" && analysis && (
        <div className="space-y-5">
          <CombinedStatsView s={analysis.stats} />

          <Card className="overflow-hidden">
            {/* Table header + controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream/60 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-ink">
                  {issuesOnly
                    ? `Issues (${flagged.length} of ${analysis.rows.length} rows)`
                    : `All rows (${analysis.rows.length})`}
                </span>
                <button
                  onClick={() => setIssuesOnly((v) => !v)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    issuesOnly
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-cream-deep text-ink-soft hover:bg-line"
                  }`}
                >
                  {issuesOnly ? "Show all rows" : `Issues only (${flagged.length})`}
                </button>
              </div>

              {(analysis.stats.mondayConflicts > 0 || analysis.stats.wednesdayConflicts > 0 || analysis.stats.tuesdayConflicts > 0 || analysis.stats.thursdayConflicts > 0 || analysis.stats.fridayConflicts > 0) && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {analysis.stats.mondayConflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink-soft">Mon conflicts:</span>
                      <button onClick={() => setAllMonday("replace")} className="rounded-lg bg-tomato-50 px-2.5 py-1 font-bold text-tomato-600 hover:bg-tomato-100">Overwrite all</button>
                      <button onClick={() => setAllMonday("keep")} className="rounded-lg bg-cream-deep px-2.5 py-1 font-bold text-ink hover:bg-line">Keep existing</button>
                      <button onClick={() => setAllMonday("add")} className="rounded-lg bg-sun-50 px-2.5 py-1 font-bold text-[oklch(0.5_0.12_70)] hover:bg-sun-100">Add</button>
                    </div>
                  )}
                  {analysis.stats.tuesdayConflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink-soft">Tue conflicts:</span>
                      <button onClick={() => setAllTuesday("replace")} className="rounded-lg bg-tomato-50 px-2.5 py-1 font-bold text-tomato-600 hover:bg-tomato-100">Overwrite all</button>
                      <button onClick={() => setAllTuesday("keep")} className="rounded-lg bg-cream-deep px-2.5 py-1 font-bold text-ink hover:bg-line">Keep existing</button>
                      <button onClick={() => setAllTuesday("add")} className="rounded-lg bg-sun-50 px-2.5 py-1 font-bold text-[oklch(0.5_0.12_70)] hover:bg-sun-100">Add</button>
                    </div>
                  )}
                  {analysis.stats.thursdayConflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink-soft">Thu conflicts:</span>
                      <button onClick={() => setAllThursday("replace")} className="rounded-lg bg-tomato-50 px-2.5 py-1 font-bold text-tomato-600 hover:bg-tomato-100">Overwrite all</button>
                      <button onClick={() => setAllThursday("keep")} className="rounded-lg bg-cream-deep px-2.5 py-1 font-bold text-ink hover:bg-line">Keep existing</button>
                      <button onClick={() => setAllThursday("add")} className="rounded-lg bg-sun-50 px-2.5 py-1 font-bold text-[oklch(0.5_0.12_70)] hover:bg-sun-100">Add</button>
                    </div>
                  )}
                  {analysis.stats.fridayConflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink-soft">Fri conflicts:</span>
                      <button onClick={() => setAllFriday("replace")} className="rounded-lg bg-tomato-50 px-2.5 py-1 font-bold text-tomato-600 hover:bg-tomato-100">Overwrite all</button>
                      <button onClick={() => setAllFriday("keep")} className="rounded-lg bg-cream-deep px-2.5 py-1 font-bold text-ink hover:bg-line">Keep existing</button>
                      <button onClick={() => setAllFriday("add")} className="rounded-lg bg-sun-50 px-2.5 py-1 font-bold text-[oklch(0.5_0.12_70)] hover:bg-sun-100">Add</button>
                    </div>
                  )}
                  {analysis.stats.wednesdayConflicts > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink-soft">Wed conflicts:</span>
                      <button onClick={() => setAllWednesday("replace")} className="rounded-lg bg-tomato-50 px-2.5 py-1 font-bold text-tomato-600 hover:bg-tomato-100">Overwrite all</button>
                      <button onClick={() => setAllWednesday("keep")} className="rounded-lg bg-cream-deep px-2.5 py-1 font-bold text-ink hover:bg-line">Keep existing</button>
                      <button onClick={() => setAllWednesday("add")} className="rounded-lg bg-sun-50 px-2.5 py-1 font-bold text-[oklch(0.5_0.12_70)] hover:bg-sun-100">Add</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-white font-extrabold text-ink">
                    <th className="px-4 py-2.5">Row</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Class</th>
                    <th className="px-4 py-2.5">Monday</th>
                    <th className="px-4 py-2.5">Tuesday</th>
<th className="px-4 py-2.5">Wednesday</th>
<th className="px-4 py-2.5">Thursday</th>
<th className="px-4 py-2.5">Friday</th>

                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {previewRows.slice(0, 500).map((r) => (
                    <tr key={r.line} className={`align-top ${
                      r.status === "error" || r.status === "duplicate" ? "bg-tomato-50/30" :
                      r.mondayConflict || r.wednesdayConflict || r.tuesdayConflict || r.thursdayConflict || r.fridayConflict ? "bg-amber-50/40" :
                      (r.mondayMenuName && !r.mondayMenuMatched) || (r.wednesdayMenuName && !r.wednesdayMenuMatched) || (r.tuesdayMenuName && !r.tuesdayMenuMatched) || (r.thursdayMenuName && !r.thursdayMenuMatched) || (r.fridayMenuName && !r.fridayMenuMatched) ? "bg-amber-50/20" : ""
                    }`}>
                      <td className="px-4 py-2.5 text-ink-faint">{r.line}</td>
                      <td className="px-4 py-2.5 font-bold text-ink">{r.studentName || <span className="text-ink-faint">—</span>}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{[r.gradeName, r.teacherName].filter(Boolean).join(" — ") || "—"}</td>
                      <td className="px-4 py-2.5">
                        <MealCell
                          menuName={r.mondayMenuName}
                          menuMatched={r.mondayMenuMatched}
                          conflict={r.mondayConflict}
                          existingName={r.mondayExistingMealName}
                          resolution={r.mondayResolution}
                          onResolution={(v) => setMondayResolution(r.line, v)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <MealCell
                          menuName={r.tuesdayMenuName}
                          menuMatched={r.tuesdayMenuMatched}
                          conflict={r.tuesdayConflict}
                          existingName={r.tuesdayExistingMealName}
                          resolution={r.tuesdayResolution}
                          onResolution={(v) => setTuesdayResolution(r.line, v)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <MealCell
                          menuName={r.wednesdayMenuName}
                          menuMatched={r.wednesdayMenuMatched}
                          conflict={r.wednesdayConflict}
                          existingName={r.wednesdayExistingMealName}
                          resolution={r.wednesdayResolution}
                          onResolution={(v) => setWednesdayResolution(r.line, v)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <MealCell
                          menuName={r.thursdayMenuName}
                          menuMatched={r.thursdayMenuMatched}
                          conflict={r.thursdayConflict}
                          existingName={r.thursdayExistingMealName}
                          resolution={r.thursdayResolution}
                          onResolution={(v) => setThursdayResolution(r.line, v)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <MealCell
                          menuName={r.fridayMenuName}
                          menuMatched={r.fridayMenuMatched}
                          conflict={r.fridayConflict}
                          existingName={r.fridayExistingMealName}
                          resolution={r.fridayResolution}
                          onResolution={(v) => setFridayResolution(r.line, v)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                        {r.issues.map((iss, j) => (
                          <p key={j} className="mt-0.5 text-xs text-tomato-600">{iss}</p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > 500 && (
              <div className="px-5 py-2 text-xs text-ink-faint">Showing first 500 of {previewRows.length} rows.</div>
            )}
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-soft">
              Ready to import <strong className="text-ink">{analysis.stats.valid}</strong> student rows,{" "}
              <strong className="text-ink">{analysis.stats.mondayOrders}</strong> Monday and{" "}
              <strong className="text-ink">{analysis.stats.wednesdayOrders}</strong> Wednesday orders, plus {analysis.stats.tuesdayOrders} Tuesday, {analysis.stats.thursdayOrders} Thursday and {analysis.stats.fridayOrders} Friday orders.
              {analysis.stats.errors > 0 && <span className="text-tomato-600"> {analysis.stats.errors} error rows will be skipped.</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button size="lg" loading={busy} onClick={confirmImport}>
                <CheckCircle2 className="h-5 w-5" /> Confirm Import
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* STEP: RESULT */}
      {step === "result" && result && (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-2xl font-extrabold text-ink">Import complete</h3>
          <p className="mt-1 text-ink-soft">Your data has been added to Cliffs Lunch Club.</p>
          <div className="mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultTile label="Rows imported" value={result.imported}        tone="green" />
            <ResultTile label="Skipped"        value={result.skipped}         tone="neutral" />
            <ResultTile label="Errors"          value={result.errors}          tone="red" />
            <ResultTile label="New students"    value={result.createdStudents} tone="green" />
          </div>
          <div className="mt-7 flex justify-center">
            <Button onClick={reset}>Import another file</Button>
          </div>
        </Card>
      )}

      {step !== "upload" && <ImportHistory history={history} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy name"
      className="ml-1 shrink-0 rounded p-0.5 text-ink-faint hover:bg-line hover:text-ink transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-leaf-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MenuReference({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-cream/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-leaf-600" />
          <span className="text-sm font-extrabold text-ink">
            Available menu items ({items.length})
          </span>
          <span className="text-xs text-ink-faint">— copy names exactly into your CSV</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-ink-faint" /> : <ChevronDown className="h-4 w-4 text-ink-faint" />}
      </button>

      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          <div className="grid gap-5 sm:grid-cols-3">
            {WEEKDAYS.map(day => <MenuGroup key={day} label={day} items={items.filter(m => m.days?.includes(day))} accentClass="text-leaf-700" />)}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Names must match exactly (case-insensitive). Use the copy button to avoid typos.
          </p>
        </div>
      )}
    </div>
  );
}

function MenuGroup({ label, items, accentClass }: { label: string; items: MenuItem[]; accentClass: string }) {
  return (
    <div>
      <p className={`mb-2 text-xs font-extrabold uppercase tracking-wide ${accentClass}`}>{label}</p>
      {items.length === 0 ? (
        <p className="text-xs text-ink-faint">None</p>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg bg-cream/60 px-2.5 py-1.5">
              <span className="text-xs font-bold text-ink">{m.name}</span>
              <CopyButton text={m.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MealCell({
  menuName, menuMatched, conflict, existingName, resolution, onResolution,
}: {
  menuName?: string; menuMatched?: boolean; conflict?: boolean;
  existingName?: string; resolution?: "keep" | "replace" | "add";
  onResolution: (v: "keep" | "replace" | "add") => void;
}) {
  if (!menuName) return <span className="text-xs text-ink-faint">—</span>;
  if (!menuMatched) return <span className="text-xs text-tomato-600">Unknown: {menuName}</span>;
  if (!conflict) return <span className="text-xs font-bold text-ink">{menuName}</span>;
  return (
    <div>
      <p className="text-xs font-bold text-ink">{menuName}</p>
      <p className="text-xs text-ink-faint">Existing: {existingName}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {(["keep", "replace", "add"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onResolution(v)}
            className={`rounded px-2 py-0.5 text-xs font-bold transition-colors ${
              resolution === v
                ? v === "keep" ? "bg-leaf-600 text-white"
                  : v === "replace" ? "bg-tomato-500 text-white"
                  : "bg-sun-400 text-white"
                : "bg-cream-deep text-ink-soft hover:bg-line"
            }`}
          >
            {v === "keep" ? "Keep" : v === "replace" ? "Overwrite" : "Add"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, tone, label }: { icon: React.ReactNode; tone: "green" | "red" | "amber" | "neutral"; label: React.ReactNode }) {
  const tones = { green: "text-leaf-700", red: "text-tomato-600", amber: "text-[oklch(0.5_0.12_70)]", neutral: "text-ink-soft" };
  return <div className={`flex items-center gap-2 text-sm font-bold ${tones[tone]}`}>{icon}{label}</div>;
}

function CombinedStatsView({ s }: { s: CombinedStats }) {
  return (
    <Card className="p-5">
      {s.menuCount === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold text-amber-800">No menu items found in the database.</p>
            <p className="mt-0.5 text-amber-700">
              Go to <strong>Menu Items</strong> in the admin panel and add your items first,
              then re-import. All meal columns will be skipped until menu items exist.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone="green"   label={<><strong>{s.valid}</strong>&nbsp;valid student rows</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone="green"   label={<><strong>{s.newStudents}</strong>&nbsp;new · <strong>{s.matchedStudents}</strong>&nbsp;existing students</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone={s.mondayOrders > 0 ? "green" : "neutral"}  label={<><strong>{s.mondayOrders}</strong>&nbsp;Monday orders matched</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone={s.tuesdayOrders > 0 ? "green" : "neutral"}  label={<><strong>{s.tuesdayOrders}</strong>&nbsp;Tuesday orders matched</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone={s.thursdayOrders > 0 ? "green" : "neutral"}  label={<><strong>{s.thursdayOrders}</strong>&nbsp;Thursday orders matched</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone={s.fridayOrders > 0 ? "green" : "neutral"}  label={<><strong>{s.fridayOrders}</strong>&nbsp;Friday orders matched</>} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone={s.wednesdayOrders > 0 ? "green" : "neutral"} label={<><strong>{s.wednesdayOrders}</strong>&nbsp;Wednesday orders matched</>} />
        <Stat icon={<AlertTriangle className="h-4 w-4" />} tone="amber"  label={<><strong>{s.mondayConflicts + s.wednesdayConflicts + s.tuesdayConflicts + s.thursdayConflicts + s.fridayConflicts}</strong>&nbsp;conflicts requiring review</>} />
        <Stat icon={<XCircle className="h-4 w-4" />}       tone="red"    label={<><strong>{s.errors}</strong>&nbsp;rows with errors</>} />
      </div>

      {s.menuCount > 0 && (s.mondayOrders === 0 && s.wednesdayOrders === 0 && s.tuesdayOrders === 0 && s.thursdayOrders === 0 && s.fridayOrders === 0) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <strong>0 orders matched</strong> even though {s.menuCount} menu item{s.menuCount !== 1 ? "s" : ""} exist in the database.
          Check that the weekday Meal column names in your CSV match the items shown in the reference panel below (or in the Upload step).
        </p>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: AnalyzedRow["status"] }) {
  if (status === "error")     return <Badge tone="red">Error</Badge>;
  if (status === "duplicate") return <Badge tone="amber">Duplicate</Badge>;
  if (status === "conflict")  return <Badge tone="amber">Conflict</Badge>;
  if (status === "new")       return <Badge tone="green">New</Badge>;
  return <Badge tone="neutral">Matched</Badge>;
}

function ResultTile({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "neutral" }) {
  const tones = { green: "text-leaf-700", red: "text-tomato-600", neutral: "text-ink" };
  return (
    <div className="rounded-xl border border-line bg-cream/50 p-4">
      <p className={`text-3xl font-extrabold ${tones[tone]}`}>{value}</p>
      <p className="text-xs font-bold text-ink-soft">{label}</p>
    </div>
  );
}

function ImportHistory({ history }: { history: HistoryRec[] }) {
  const typeLabel = (t: string) => {
    if (t === "combined") return <Badge tone="neutral">Combined</Badge>;
    if (t === "roster")   return <Badge tone="green">Roster</Badge>;
    return <Badge tone="sun">Orders</Badge>;
  };
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-cream/60 px-5 py-3 text-sm font-extrabold text-ink">
        <History className="h-4 w-4 text-leaf-600" /> Import history
      </div>
      {history.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-faint">No imports yet.</p>
      ) : (
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-white font-extrabold text-ink">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">File</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Admin</th>
                <th className="px-4 py-2.5 text-center">Processed</th>
                <th className="px-4 py-2.5 text-center">Imported</th>
                <th className="px-4 py-2.5 text-center">Skipped</th>
                <th className="px-4 py-2.5 text-center">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-leaf-50/40">
                  <td className="px-4 py-2.5 text-xs text-ink-faint">{formatDateTime(h.created)}</td>
                  <td className="px-4 py-2.5 font-bold text-ink">{h.filename}</td>
                  <td className="px-4 py-2.5">{typeLabel(h.import_type)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{h.expand?.admin?.first_name} {h.expand?.admin?.last_name}</td>
                  <td className="px-4 py-2.5 text-center text-ink-soft">{h.rows_processed}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-leaf-700">{h.rows_imported}</td>
                  <td className="px-4 py-2.5 text-center text-ink-soft">{h.rows_skipped}</td>
                  <td className="px-4 py-2.5 text-center text-tomato-600">{h.rows_errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
