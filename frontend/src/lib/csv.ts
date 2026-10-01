// CSV import helpers. Parsing itself is done server-side (/api/import/parse-csv);
// these helpers handle normalization, matching and column auto-mapping.

export function norm(s: string | undefined): string {
  return (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Canonical token for a grade so "3", "Grade 3", "grade 3" all match. */
export function gradeToken(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  if (/^k(inder)?(garten)?$/.test(n) || n === "kg") return "k";
  // Don't extract digits from time-like values (e.g. "10:45", "FACULTY/STAFF 10:45")
  if (n.includes(":")) return n;
  const m = n.match(/(\d+)/);
  if (m) return m[1];
  return n;
}

/** Human-friendly grade name from a raw token/value. */
export function gradeDisplayName(raw: string): string {
  const token = gradeToken(raw);
  if (token === "k") return "Kindergarten";
  if (/^\d+$/.test(token)) return `Grade ${token}`;
  // Title-case fallback
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Title-case a teacher / free-text name while preserving inner capitals. */
export function cleanName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** Split a combined "3-DelPriore" / "Grade 3 / DelPriore" field. */
export function splitGradeTeacher(raw: string): { grade: string; teacher: string } {
  const value = (raw ?? "").trim();
  if (!value) return { grade: "", teacher: "" };
  const m = value.split(/\s*[-/|:]\s*/);
  if (m.length >= 2) {
    return { grade: m[0].trim(), teacher: m.slice(1).join(" ").trim() };
  }
  return { grade: value, teacher: "" };
}

/** Parse a date-ish string into a Date (calendar day). Returns null if invalid. */
export function parseDate(raw: string): Date | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  // Try native first (handles ISO and many US formats)
  let d = new Date(v);
  if (!isNaN(d.getTime())) return d;
  // Try M/D/YYYY or D/M/YYYY fallback
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    d = new Date(year, Number(a) - 1, Number(b));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/** Same calendar day (local). */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Auto-guess which CSV column index maps to a target field, by header keywords. */
export function guessColumn(headers: string[], keywords: string[]): number {
  const H = headers.map(norm);
  for (const kw of keywords) {
    const idx = H.findIndex((h) => h === kw);
    if (idx >= 0) return idx;
  }
  for (const kw of keywords) {
    const idx = H.findIndex((h) => h.includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Serialize a matrix of cells into a CSV string with proper escaping. */
export function toCsv(rows: string[][]): string {
  const esc = (v: string) => {
    const s = v ?? "";
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Trigger a client-side download of text content as a file. */
export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
