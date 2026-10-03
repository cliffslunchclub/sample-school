import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, UtensilsCrossed, Upload, Download, CheckCircle2, FileSpreadsheet } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { Card, Button, Input, Textarea, Field, Modal, Spinner, EmptyState, Badge, useToast } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import type { MenuItem } from "../../lib/types";
import { downloadFile, toCsv } from "../../lib/csv";
import { BatchWriteError, type BatchProgress } from "../../lib/pocketbaseBatch";
import { analyzeMenuCsv, executeMenuImport, MENU_CSV_HEADERS, parseCsvText, type MenuImportRow } from "../../lib/menuImport";
import { WEEKDAYS, type Weekday } from "../../lib/semester";
const DAY_OPTIONS = WEEKDAYS;

export default function Menu() {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvFilename, setCsvFilename] = useState("");
  const [csvRows, setCsvRows] = useState<MenuImportRow[] | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvSaving, setCsvSaving] = useState(false);

  const load = async () => {
    const mi = await pb.collection("menu_items").getFullList<MenuItem>({ sort: "name", requestKey: null });
    setItems(mi);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const downloadTemplate = () => downloadFile("cliffs-menu-template.csv", toCsv([MENU_CSV_HEADERS]));

  const onMenuCsv = async (file: File) => {
    setCsvBusy(true);
    try {
      const rows = parseCsvText(await file.text());
      const preview = analyzeMenuCsv(rows, items);
      setCsvFilename(file.name);
      setCsvRows(preview);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not read the menu CSV.", "error");
      setCsvRows(null);
    } finally {
      setCsvBusy(false);
      if (csvRef.current) csvRef.current.value = "";
    }
  };

  const setResolution = (line: number, resolution: "keep" | "update") =>
    setCsvRows((current) => current?.map((row) => row.line === line ? { ...row, resolution } : row) ?? null);

  const confirmMenuCsv = async () => {
    if (!csvRows || !user?.school) return;
    if (csvRows.some((row) => row.status === "error")) {
      toast("Fix or remove the invalid rows before confirming.", "error");
      return;
    }
    setCsvSaving(true);
    const progress: BatchProgress = { count: 0, records: 0 };
    try {
      const result = await executeMenuImport(csvRows, user.school, progress);
      await load();
      toast(`Menu upload complete: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged.`);
      setCsvRows(null);
      setCsvFilename("");
    } catch (error) {
      try { await load(); } catch { /* Show the write result even if refresh fails. */ }
      const committed = progress.records || 0;
      const progressText = committed ? ` ${committed} records in ${progress.count} batches were saved before it stopped.` : " No records were confirmed saved.";
      const detail = error instanceof BatchWriteError && /Batch requests are not allowed/i.test(error.message)
        ? " Enable Batch API in PocketBase Dashboard → Settings → Application."
        : " Refresh the menu and review the records before retrying.";
      toast(`Menu upload stopped.${progressText}${detail}`, "error");
      setCsvRows(null);
    } finally {
      setCsvSaving(false);
    }
  };

  const toggleActive = async (m: MenuItem) => {
    await pb.collection("menu_items").update(m.id, { active: !m.active });
    toast(m.active ? "Item deactivated" : "Item activated");
    load();
  };

  if (loading) return <Spinner label="Loading menu…" />;

  return (
    <div>
      <PageHeader
        title="Menu"
        desc="Manage meals available to parents on each service day"
        action={<Button size="lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-5 w-5" /> Add Item</Button>}
      />

      <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onMenuCsv(file); }} />
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" />
            <div>
              <p className="font-extrabold text-ink">Bulk menu upload</p>
              <p className="text-sm text-ink-soft">This uploads menu items only; it does not import student orders. Existing items default to Keep Existing unless you choose Update.</p>
              <p className="mt-1 text-xs text-ink-faint">Use Yes or No for each weekday. Blank Active means active. Items not listed in the CSV are never changed or deleted.</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download template</Button>
            <Button variant="outline" onClick={() => csvRef.current?.click()} loading={csvBusy}><Upload className="h-4 w-4" /> Upload menu CSV</Button>
          </div>
        </div>
      </Card>

      {csvRows && (
        <Card className="mb-5 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h2 className="font-extrabold text-ink">Review {csvFilename}</h2>
              <p className="text-sm text-ink-soft">Nothing is saved until you confirm. Name matches are checked without regard to capitalization.</p>
            </div>
            <Button variant="outline" onClick={() => { setCsvRows(null); setCsvFilename(""); }}>Cancel upload</Button>
          </div>
          <div className="flex flex-wrap gap-2 p-4 pb-2 text-xs font-bold">
            <Badge tone="green">{csvRows.filter((r) => r.status === "new").length} new</Badge>
            <Badge tone="amber">{csvRows.filter((r) => r.status === "conflict").length} existing matches</Badge>
            <Badge tone="neutral">{csvRows.filter((r) => r.status === "same").length} unchanged</Badge>
            {csvRows.some((r) => r.status === "error") && <Badge tone="red">{csvRows.filter((r) => r.status === "error").length} need fixing</Badge>}
          </div>
          <div className="max-h-[28rem] overflow-auto px-4 pb-4">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-cream text-xs uppercase tracking-wide text-ink-faint">
                <tr><th className="py-2 pr-3">Row</th><th className="py-2 pr-3">Menu item</th><th className="py-2 pr-3">Days</th><th className="py-2 pr-3">Active</th><th className="py-2 pr-3">Action</th><th className="py-2">Resolution</th></tr>
              </thead>
              <tbody>
                {csvRows.map((row) => (
                  <tr key={row.line} className="border-t border-line align-top">
                    <td className="py-2 pr-3 text-ink-faint">{row.line}</td>
                    <td className="py-2 pr-3"><div className="font-bold text-ink">{row.name || "(blank name)"}</div>{row.message && <div className={`mt-0.5 text-xs ${row.status === "error" ? "text-tomato-700" : "text-ink-faint"}`}>{row.message}</div>}{row.description && <div className="mt-0.5 max-w-sm text-xs text-ink-soft">{row.description}</div>}</td>
                    <td className="py-2 pr-3 text-ink-soft">{row.days.join(", ") || "—"}</td>
                    <td className="py-2 pr-3">{row.status === "error" ? "—" : row.active ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3">
                      {row.status === "new" && <Badge tone="green">Add</Badge>}
                      {row.status === "same" && <Badge tone="neutral">Unchanged</Badge>}
                      {row.status === "error" && <Badge tone="red">Fix row</Badge>}
                      {row.status === "conflict" && <Badge tone={row.resolution === "update" ? "amber" : "neutral"}>{row.resolution === "update" ? "Update" : "Keep existing"}</Badge>}
                    </td>
                    <td className="py-2">
                      {row.status === "conflict" && <select value={row.resolution} onChange={(e) => setResolution(row.line, e.target.value as "keep" | "update")} className="rounded-lg border border-line bg-white px-2 py-1 text-sm"><option value="keep">Keep existing</option><option value="update">Update existing</option></select>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-cream/40 p-4">
            <p className="flex items-center gap-2 text-xs text-ink-soft"><CheckCircle2 className="h-4 w-4 text-leaf-600" /> Existing orders keep their menu item link when item details are updated.</p>
            <Button onClick={confirmMenuCsv} loading={csvSaving} disabled={csvRows.some((r) => r.status === "error")}><Upload className="h-4 w-4" /> Confirm menu upload</Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-7 w-7" />} title="No menu items yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold text-ink">{m.name}</p>
                <button onClick={() => { setEditing(m); setOpen(true); }} className="rounded-lg p-1.5 text-ink-faint hover:bg-cream-deep hover:text-leaf-700">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {m.description && <p className="mt-1 text-sm text-ink-soft">{m.description}</p>}
              <div className="mt-auto pt-3 flex flex-wrap items-center gap-1.5">
                <button onClick={() => toggleActive(m)}>
                  <Badge tone={m.active ? "green" : "red"}>{m.active ? "Active" : "Inactive"}</Badge>
                </button>
                {(m.days ?? []).map((d) => (
                  <Badge key={d} tone="neutral">{d}</Badge>
                ))}
                {(m.days ?? []).length === 0 && (
                  <Badge tone="amber">No days set</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <MenuForm
          key={editing?.id ?? "new"}
          item={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); load(); toast(editing ? "Item updated" : "Item added"); }}
        />
      )}
    </div>
  );
}

function MenuForm({
  item, onClose, onSaved,
}: {
  item: MenuItem | null; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [days, setDays] = useState<Weekday[]>(item?.days ?? [...WEEKDAYS]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: Weekday) =>
    setDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (days.length === 0) {
      toast("Select at least one service day", "error");
      return;
    }
    setSaving(true);
    try {
      if (item) {
        await pb.collection("menu_items").update(item.id, { name, description, active, days });
      } else {
        await pb.collection("menu_items").create({ name, description, active, days, school: user!.school });
      }
      onSaved();
    } catch {
      toast("Could not save item", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={item ? "Edit Menu Item" : "Add Menu Item"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Available on">
          <div className="flex flex-wrap gap-4 pt-0.5">
            {DAY_OPTIONS.map((day) => (
              <label key={day} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="h-4 w-4 accent-[oklch(0.5_0.13_155)]"
                />
                {day}
              </label>
            ))}
          </div>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[oklch(0.5_0.13_155)]" />
          Active (shown to parents)
        </label>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>{item ? "Save changes" : "Add item"}</Button>
        </div>
      </form>
    </Modal>
  );
}
