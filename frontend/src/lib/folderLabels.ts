/**
 * Print-ready Avery 5160 / 8160 folder labels based on the same
 * aggregated rows displayed in the CHS Order Summary.
 * No student data is sent to a third-party PDF service.
 */
export interface FolderSummaryRow {
  name: string;
  counts: Record<string, number>;
  total: number;
}
export interface FolderDeliveryTime { id: string; label: string }
export interface FolderEntry {
  time: string;
  count: number;
  caesar?: number;
  plain?: number;
}
export interface FolderLabel {
  title: string;
  entries: FolderEntry[];
  total: number;
  wraps: boolean;
}

export const DEFAULT_SEPARATE_ITEMS = new Set([
  "cheeseburger sliders + tt",
  "chicken katsu curry bowl",
  "chicken nuggets + tt",
  "chicken quesadilla",
  "grilled cheese + tt",
]);

export const isCaesarWrap = (name: string) => name.trim().toLowerCase() === "grilled chicken caesar wrap";
export const isPlainWrap = (name: string) => name.trim().toLowerCase() === "grilled chicken wrap (plain)";
export const defaultSeparate = (name: string) => DEFAULT_SEPARATE_ITEMS.has(name.trim().toLowerCase());

const countFor = (row: FolderSummaryRow, id: string) => Math.max(0, Number(row.counts[id]) || 0);

/** Include a missing/inactive time as Unassigned, rather than silently dropping its meals. */
function entriesFor(row: FolderSummaryRow, times: FolderDeliveryTime[]): FolderEntry[] {
  const entries = times.map(t => ({ time: t.label, count: countFor(row, t.id) })).filter(t => t.count > 0);
  const known = entries.reduce((sum, entry) => sum + entry.count, 0);
  const unassigned = Math.max(0, row.total - known);
  if (unassigned > 0) entries.push({ time: "Unassigned", count: unassigned });
  return entries;
}

/**
 * Modes can be changed in the preview and are keyed by the live menu name.
 * Both wrap variants can occupy a single folder but retain a visible C/P breakdown.
 */
export function buildFolderLabels(
  rows: FolderSummaryRow[],
  times: FolderDeliveryTime[],
  overrides: Record<string, boolean> = {},
  combineWraps = true,
): FolderLabel[] {
  const result: FolderLabel[] = [];
  const wrapRows: FolderSummaryRow[] = [];

  for (const row of rows) {
    if (!row.total) continue;
    if (combineWraps && (isCaesarWrap(row.name) || isPlainWrap(row.name))) {
      wrapRows.push(row);
      continue;
    }
    const entries = entriesFor(row, times);
    const separate = overrides[row.name] ?? defaultSeparate(row.name);
    if (separate) {
      entries.forEach(entry => result.push({
        title: row.name, entries: [entry], total: entry.count, wraps: false,
      }));
    } else {
      result.push({ title: row.name, entries, total: row.total, wraps: false });
    }
  }

  if (wrapRows.length) {
    const caesar = wrapRows.find(row => isCaesarWrap(row.name));
    const plain = wrapRows.find(row => isPlainWrap(row.name));
    const caesarEntries = caesar ? entriesFor(caesar, times) : [];
    const plainEntries = plain ? entriesFor(plain, times) : [];
    const labels = [...times.map(time => time.label), "Unassigned"];
    const entries: FolderEntry[] = labels.flatMap(time => {
      const c = caesarEntries.find(entry => entry.time === time)?.count ?? 0;
      const p = plainEntries.find(entry => entry.time === time)?.count ?? 0;
      return c + p > 0 ? [{ time, count: c + p, caesar: c, plain: p }] : [];
    });
    // Preserve unexpected delivery slot names as well as the declared slots.
    for (const entry of [...caesarEntries, ...plainEntries]) {
      if (labels.includes(entry.time)) continue;
      const existing = entries.find(e => e.time === entry.time);
      if (existing) {
        existing.count += entry.count;
        if (caesarEntries.includes(entry)) existing.caesar = (existing.caesar ?? 0) + entry.count;
        else existing.plain = (existing.plain ?? 0) + entry.count;
      } else {
        entries.push({ time: entry.time, count: entry.count,
          caesar: caesarEntries.includes(entry) ? entry.count : 0,
          plain: plainEntries.includes(entry) ? entry.count : 0 });
      }
    }
    result.push({
      title: "Grilled Chicken Wraps",
      entries,
      total: wrapRows.reduce((sum, row) => sum + row.total, 0),
      wraps: true,
    });
  }
  return result.sort((a, b) => a.title.localeCompare(b.title) || a.entries[0]?.time.localeCompare(b.entries[0]?.time || "") || 0);
}

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch] || ch));

function labelHtml(folder: FolderLabel): string {
  const lines = folder.entries.map(entry => {
    const details = folder.wraps ? `  (C ${entry.caesar ?? 0} / P ${entry.plain ?? 0})` : "";
    return `<div class="time-row">${esc(entry.time)} - ${entry.count}${esc(details)}</div>`;
  }).join("");
  return `<div class="sticker">
  <div class="folder-title">${esc(folder.title)}</div>
  <div class="time-rows">${lines}</div>
  <div class="folder-total">Total - ${folder.total}</div>
  ${folder.wraps ? '<div class="wrap-key">C = Caesar / P = Plain</div>' : ""}
</div>`;
}

/** 15 folders / page, two matching adjacent vertical stickers for each folder. */
export function folderLabelsHtml(folders: FolderLabel[]): string {
  const pages: string[] = [];
  for (let pageStart = 0; pageStart < folders.length; pageStart += 15) {
    const page = folders.slice(pageStart, pageStart + 15);
    const cells: string[] = [];
    for (let col = 0; col < 3; col++) {
      for (let pair = 0; pair < 5; pair++) {
        const folder = page[col * 5 + pair];
        for (let copy = 0; copy < 2; copy++) cells.push(folder ? labelHtml(folder) : '<div class="sticker empty"></div>');
      }
    }
    pages.push(`<section class="sheet">${cells.join("")}</section>`);
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Cherry Hill Folder Labels</title>
<style>
@page{size:letter portrait;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#181818;background:#e9e9e9}
.toolbar{padding:16px;text-align:center}
.toolbar button{padding:10px 20px;font-size:16px;cursor:pointer}
.toolbar p{font-size:14px;margin:8px 0}
.sheet{width:8.5in;height:11in;padding:.5in .1875in;display:grid;grid-template-columns:repeat(3,2.625in);grid-template-rows:repeat(10,1in);column-gap:.125in;background:white;margin:16px auto;break-after:page}
.sheet:last-child{break-after:auto}
.sticker{width:2.625in;height:1in;position:relative;overflow:hidden;break-inside:avoid}
.folder-title{position:absolute;top:6pt;left:8pt;right:8pt;white-space:nowrap;overflow:visible;font-weight:700;font-size:11.7pt;line-height:14pt}
.time-rows{position:absolute;top:25pt;left:8pt;right:8pt;font-size:10.3pt;line-height:13pt;white-space:nowrap}
.folder-total{position:absolute;right:8pt;bottom:13.6pt;font-weight:700;font-size:10.3pt;line-height:12pt;white-space:nowrap}
.wrap-key{position:absolute;left:8pt;bottom:3.5pt;font-size:6.3pt;line-height:7pt;white-space:nowrap}
@media screen{.sticker{outline:1px dashed #ddd}}
@media print{body{background:white}.toolbar{display:none}.sheet{margin:0}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button>
<p>Avery 5160 / 8160 · US Letter · Actual size (100%) · No browser headers or footers. Test on plain paper first.</p></div>
${pages.join("")}
<script>
for (const title of document.querySelectorAll('.folder-title')) {
 let size = 11.7;
 while (title.scrollWidth > title.clientWidth + 1 && size > 8.1) {
  size -= .2; title.style.fontSize = size + 'pt';
 }
}
for (const rows of document.querySelectorAll('.time-rows')) {
 let size = 10.3;
 while (rows.scrollHeight > 30 && size > 7) {
  size -= .2; rows.style.fontSize = size + 'pt'; rows.style.lineHeight = (size + 2.7) + 'pt';
 }
}
</script></body></html>`;
}
