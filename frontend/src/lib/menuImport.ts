import { norm } from "./csv";
import { WEEKDAYS, type Weekday } from "./semester";
import type { MenuItem } from "./types";
import { sendBatchRequests, type BatchProgress } from "./pocketbaseBatch";
import type { BatchRequest } from "./pocketbaseBatch";

export const MENU_CSV_HEADERS = [
  "Menu Item", "Description", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Active",
];

export type MenuImportStatus = "new" | "same" | "conflict" | "error";
export interface MenuImportRow {
  line: number;
  name: string;
  description: string;
  active: boolean;
  days: Weekday[];
  status: MenuImportStatus;
  message: string;
  resolution: "keep" | "update";
  existingId?: string;
}

/** Parse quoted CSV fields, escaped quotes, and embedded line breaks. */
export function parseCsvText(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field.length === 0) {
      quoted = true;
    } else if (c === ",") {
      row.push(field.trim()); field = "";
    } else if (c === "\n") {
      row.push(field.trim()); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  const nonempty = rows.filter((cells) => cells.some((cell) => cell !== ""));
  if (nonempty.length < 2) throw new Error("Add at least one menu item below the header row.");
  return nonempty;
}

function headerKey(value: string): string {
  return norm(value).replace(/[_-]+/g, " ");
}

function parseBoolean(value: string, field: string, line: number, blankDefault: boolean): boolean {
  const v = norm(value);
  if (!v) return blankDefault;
  if (["yes", "y", "true", "1", "x"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  throw new Error(`Row ${line}: ${field} must be Yes or No.`);
}

function sameDays(a: readonly string[] | undefined, b: readonly Weekday[]): boolean {
  const left = WEEKDAYS.filter((day) => (a || []).includes(day));
  return left.length === b.length && left.every((day, index) => day === b[index]);
}

export function analyzeMenuCsv(matrix: string[][], existing: MenuItem[]): MenuImportRow[] {
  if (matrix.length < 2) throw new Error("Add at least one menu item below the header row.");
  const headers = matrix[0].map(headerKey);
  if (new Set(headers).size !== headers.length) throw new Error("The header row contains duplicate column names.");
  const nameIdx = headers.findIndex((h) => ["menu item", "name", "item"].includes(h));
  if (nameIdx < 0) throw new Error('The header row needs a "Menu Item" column.');
  const dayIndexes = new Map<Weekday, number>();
  WEEKDAYS.forEach((day) => {
    const idx = headers.indexOf(day.toLowerCase());
    if (idx >= 0) dayIndexes.set(day, idx);
  });
  const missingDays = WEEKDAYS.filter((day) => !dayIndexes.has(day));
  if (missingDays.length) throw new Error(`Missing service-day columns: ${missingDays.join(", ")}.`);
  const descriptionIdx = headers.findIndex((h) => h === "description");
  const activeIdx = headers.findIndex((h) => h === "active");
  const existingByName = new Map<string, MenuItem[]>();
  existing.forEach((item) => {
    const key = norm(item.name);
    existingByName.set(key, [...(existingByName.get(key) || []), item]);
  });
  const seen = new Set<string>();
  const rows = matrix.slice(1).map((cells, index): MenuImportRow => {
    const line = index + 2;
    const cell = (idx: number) => (cells[idx] || "").trim();
    const name = cell(nameIdx).replace(/\s+/g, " ");
    const description = descriptionIdx < 0 ? "" : cell(descriptionIdx).replace(/\s+/g, " ");
    try {
      if (cells.slice(headers.length).some((value) => (value || "").trim())) throw new Error(`Row ${line}: there are more values than header columns.`);
      if (!name) throw new Error(`Row ${line}: menu item name is required.`);
      const key = norm(name);
      if (seen.has(key)) throw new Error(`Row ${line}: duplicate menu item "${name}" in this file.`);
      seen.add(key);
      const days = WEEKDAYS.filter((day) => parseBoolean(cell(dayIndexes.get(day)!), day, line, false));
      if (!days.length) throw new Error(`Row ${line}: select Yes for at least one service day.`);
      const active = activeIdx < 0 ? true : parseBoolean(cell(activeIdx), "Active", line, true);
      const matches = existingByName.get(key) || [];
      if (matches.length > 1) throw new Error(`Row ${line}: more than one existing menu item matches "${name}". Resolve the duplicate in Menu first.`);
      const found = matches[0];
      if (!found) return { line, name, description, active, days, status: "new", message: "Will add new menu item.", resolution: "keep" };
      const unchanged = found.name === name && (found.description || "") === description && !!found.active === active && sameDays(found.days, days);
      if (unchanged) return { line, name, description, active, days, status: "same", message: "Already matches the current menu.", resolution: "keep", existingId: found.id };
      return { line, name, description, active, days, status: "conflict", message: "Existing item differs. Choose whether to update it.", resolution: "keep", existingId: found.id };
    } catch (error) {
      return { line, name, description, active: true, days: [], status: "error", message: error instanceof Error ? error.message : "Invalid menu item.", resolution: "keep" };
    }
  });
  return rows;
}

export async function executeMenuImport(rows: MenuImportRow[], schoolId: string, progress: BatchProgress) {
  if (rows.some((row) => row.status === "error")) throw new Error("Fix all invalid rows before confirming the menu upload.");
  const requests: BatchRequest[] = [];
  let added = 0;
  let updated = 0;
  for (const row of rows) {
    if (row.status === "same" || (row.status === "conflict" && row.resolution === "keep")) continue;
    const body = { name: row.name, description: row.description, active: row.active, days: row.days };
    if (row.status === "new") {
      requests.push({ method: "POST", url: "/api/collections/menu_items/records", body: { ...body, school: schoolId } });
      added++;
    } else if (row.status === "conflict" && row.resolution === "update" && row.existingId) {
      requests.push({ method: "PATCH", url: `/api/collections/menu_items/records/${row.existingId}`, body });
      updated++;
    }
  }
  await sendBatchRequests(requests, "Menu items", progress);
  return { added, updated, unchanged: rows.length - added - updated };
}
