import pb from "./pocketbase";
import {
  norm, gradeToken, splitGradeTeacher, cleanName,
} from "./csv";
import type {
  Grade, Teacher, Student, MenuItem, DeliveryTime, DeliveryRule, MealSelection,
} from "./types";

export type ImportType = "roster" | "orders" | "combined";
export type Mapping = Record<string, number>;
export type RowStatus = "new" | "matched" | "duplicate" | "error" | "conflict";

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  keywords: string[];
}

/** Single combined template — one row per student, two optional meal columns. */
export const COMBINED_FIELDS: FieldDef[] = [
  { key: "student_name",  label: "Student Name",              required: true,  keywords: ["student name", "student", "name", "child"] },
  { key: "grade",         label: "Grade",                     required: false, keywords: ["grade level", "grade"] },
  { key: "teacher",       label: "Teacher",                   required: false, keywords: ["teacher", "homeroom"] },
  { key: "grade_teacher", label: "Grade/Teacher (combined)",  required: false, keywords: ["grade/teacher", "grade-teacher", "classroom", "class"] },
  { key: "delivery_time", label: "Delivery Time",             required: false, keywords: ["delivery time", "delivery", "time"] },
  { key: "monday_meal",   label: "Monday Meal",               required: false, keywords: ["monday meal", "monday", "mon meal", "mon"] },
  { key: "wednesday_meal",label: "Wednesday Meal",            required: false, keywords: ["wednesday meal", "wednesday", "wed meal", "wed"] },
];

export function fieldsFor(_type: ImportType): FieldDef[] {
  return COMBINED_FIELDS;
}

export interface RefData {
  grades: Grade[];
  teachers: Teacher[];
  students: Student[];
  menu: MenuItem[];
  times: DeliveryTime[];
  rules: DeliveryRule[];
  selections: MealSelection[];
}

export async function loadRefData(): Promise<RefData> {
  const [grades, teachers, students, menu, times, rules, selections] = await Promise.all([
    pb.collection("grades").getFullList<Grade>({ requestKey: null }),
    pb.collection("teachers").getFullList<Teacher>({ requestKey: null }),
    pb.collection("students").getFullList<Student>({ requestKey: null }),
    pb.collection("menu_items").getFullList<MenuItem>({ requestKey: null }),
    pb.collection("delivery_time_slots").getFullList<DeliveryTime>({ requestKey: null }),
    pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
    pb.collection("meal_selections").getFullList<MealSelection>({ requestKey: null }),
  ]);
  return { grades, teachers, students, menu, times, rules, selections };
}

export interface AnalyzedRow {
  line: number;
  status: RowStatus;
  issues: string[];
  studentName: string;
  gradeName: string;
  teacherName: string;
  deliveryLabel: string;
  studentNew: boolean;
  teacherNew: boolean;
  gradeNew: boolean;
  deliveryNew: boolean;
  // Per-day (combined import)
  mondayMenuName?: string;
  mondayMenuMatched?: boolean;
  mondayConflict?: boolean;
  mondayExistingMealName?: string;
  mondayResolution?: "keep" | "replace" | "add";
  wednesdayMenuName?: string;
  wednesdayMenuMatched?: boolean;
  wednesdayConflict?: boolean;
  wednesdayExistingMealName?: string;
  wednesdayResolution?: "keep" | "replace" | "add";
  raw: {
    name: string; gradeRaw: string; teacherRaw: string; deliveryRaw: string;
    mondayMenuRaw?: string; wednesdayMenuRaw?: string;
  };
}

export interface CombinedStats {
  total: number;
  valid: number;
  newStudents: number;
  matchedStudents: number;
  newTeachers: number;
  matchedTeachers: number;
  mondayOrders: number;
  wednesdayOrders: number;
  mondayConflicts: number;
  wednesdayConflicts: number;
  duplicates: number;
  errors: number;
  menuCount: number; // total menu items available in DB
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function get(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? row[idx] : "";
}

function resolveGradeTeacher(row: string[], m: Mapping) {
  let gradeRaw = get(row, m.grade ?? -1);
  let teacherRaw = get(row, m.teacher ?? -1);
  if ((m.grade_teacher ?? -1) >= 0) {
    const s = splitGradeTeacher(get(row, m.grade_teacher));
    if (!gradeRaw) gradeRaw = s.grade;
    if (!teacherRaw) teacherRaw = s.teacher;
  }
  return { gradeRaw: gradeRaw.trim(), teacherRaw: teacherRaw.trim() };
}

interface Indexes {
  gradeByToken: Map<string, Grade>;
  teacherByKey: Map<string, Teacher>;
  timeByNorm: Map<string, DeliveryTime>;
  menuByNorm: Map<string, MenuItem>;
  menuById: Map<string, MenuItem>;
  studentByKey: Map<string, Student>;
  selByKey: Map<string, MealSelection>;
}

function buildIndexes(ref: RefData): Indexes {
  const gradeById = new Map(ref.grades.map((g) => [g.id, g]));
  const teacherById = new Map(ref.teachers.map((t) => [t.id, t]));
  const gradeByToken = new Map<string, Grade>();
  ref.grades.forEach((g) => gradeByToken.set(gradeToken(g.name), g));
  const teacherByKey = new Map<string, Teacher>();
  ref.teachers.forEach((t) => teacherByKey.set(`${t.grade}|${norm(t.name)}`, t));
  const timeByNorm = new Map(ref.times.map((t) => [norm(t.label), t]));
  const menuByNorm = new Map(ref.menu.map((m) => [norm(m.name), m]));
  const menuById = new Map(ref.menu.map((m) => [m.id, m]));
  const studentByKey = new Map<string, Student>();
  ref.students.forEach((s) => {
    const g = gradeById.get(s.grade);
    const t = teacherById.get(s.teacher);
    studentByKey.set(`${norm(s.name)}|${gradeToken(g?.name || "")}|${norm(t?.name || "")}`, s);
  });
  const selByKey = new Map<string, MealSelection>();
  ref.selections.forEach((s) => {
    const dk = s.lunch_date ? s.lunch_date.slice(0, 10) : "";
    if (dk) selByKey.set(`${s.student}|${dk}`, s);
  });
  return { gradeByToken, teacherByKey, timeByNorm, menuByNorm, menuById, studentByKey, selByKey };
}

// ─── Fuzzy menu lookup ────────────────────────────────────────────────────────
// Tries exact match first, then substring containment, then significant-word
// overlap (≥ 60% of words with length > 2 must match). This tolerates minor
// name differences like "Chicken Nuggets" vs "Chicken Nuggets + TT".
function fuzzyFindMenu(raw: string, menuByNorm: Map<string, MenuItem>): MenuItem | undefined {
  const csvNorm = norm(raw);
  if (!csvNorm) return undefined;

  // 1. Exact match
  const exact = menuByNorm.get(csvNorm);
  if (exact) return exact;

  // 2. One contains the other
  for (const [dbNorm, item] of menuByNorm) {
    if (dbNorm.includes(csvNorm) || csvNorm.includes(dbNorm)) return item;
  }

  // 3. Word-overlap score
  const csvWords = new Set(csvNorm.split(/\s+/).filter((w) => w.length > 2));
  if (csvWords.size === 0) return undefined;

  let bestScore = 0;
  let bestItem: MenuItem | undefined;
  for (const [dbNorm, item] of menuByNorm) {
    const dbWords = new Set(dbNorm.split(/\s+/).filter((w) => w.length > 2));
    if (dbWords.size === 0) continue;
    let matches = 0;
    for (const w of csvWords) { if (dbWords.has(w)) matches++; }
    const score = matches / Math.max(csvWords.size, dbWords.size);
    if (score > bestScore) { bestScore = score; bestItem = item; }
  }
  return bestScore >= 0.6 ? bestItem : undefined;
}

// ─── Combined analyze ─────────────────────────────────────────────────────────

export function analyzeCombined(
  rows: string[][],
  m: Mapping,
  ref: RefData,
  mondayKey: string,
  wednesdayKey: string,
): { rows: AnalyzedRow[]; stats: CombinedStats } {
  const ix = buildIndexes(ref);
  const seen = new Set<string>();
  const newTeacherKeys = new Set<string>();
  const matchedTeacherIds = new Set<string>();
  const out: AnalyzedRow[] = [];
  let newStudents = 0, matchedStudents = 0, duplicates = 0, errors = 0;
  let mondayOrders = 0, wednesdayOrders = 0;
  let mondayConflicts = 0, wednesdayConflicts = 0;

  rows.forEach((row, i) => {
    const name = cleanName(get(row, m.student_name ?? -1));
    const { gradeRaw, teacherRaw } = resolveGradeTeacher(row, m);
    const deliveryRaw = cleanName(get(row, m.delivery_time ?? -1));
    const mondayMenuRaw = cleanName(get(row, m.monday_meal ?? -1));
    const wednesdayMenuRaw = cleanName(get(row, m.wednesday_meal ?? -1));
    const issues: string[] = [];

    // Grade / teacher matching
    const gradeMatch = gradeRaw ? ix.gradeByToken.get(gradeToken(gradeRaw)) : undefined;
    const teacherMatch = gradeMatch && teacherRaw
      ? ix.teacherByKey.get(`${gradeMatch.id}|${norm(teacherRaw)}`)
      : undefined;
    const gradeNew = !!gradeRaw && !gradeMatch;
    const teacherNew = !!teacherRaw && !teacherMatch;
    const deliveryNew = !!deliveryRaw && !ix.timeByNorm.get(norm(deliveryRaw));

    // Student matching
    let studentMatch: Student | undefined;
    if (gradeMatch && teacherMatch) {
      studentMatch = ix.studentByKey.get(`${norm(name)}|${gradeToken(gradeRaw)}|${norm(teacherRaw)}`);
    }

    // Fatal validation
    if (!name) issues.push("Missing student name");
    if (!gradeRaw) issues.push("Missing grade");
    if (!teacherRaw) issues.push("Missing teacher");

    // Menu item matching — fuzzy to tolerate minor name differences
    const mondayMenuMatch = mondayMenuRaw ? fuzzyFindMenu(mondayMenuRaw, ix.menuByNorm) : undefined;
    const wednesdayMenuMatch = wednesdayMenuRaw ? fuzzyFindMenu(wednesdayMenuRaw, ix.menuByNorm) : undefined;

    // Conflict detection per day
    let mondayConflict = false, wednesdayConflict = false;
    let mondayExistingMealName: string | undefined, wednesdayExistingMealName: string | undefined;
    if (studentMatch) {
      if (mondayMenuMatch) {
        const ex = ix.selByKey.get(`${studentMatch.id}|${mondayKey}`);
        if (ex) {
          mondayConflict = true;
          mondayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
        }
      }
      if (wednesdayMenuMatch) {
        const ex = ix.selByKey.get(`${studentMatch.id}|${wednesdayKey}`);
        if (ex) {
          wednesdayConflict = true;
          wednesdayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
        }
      }
    }

    const dupKey = `${norm(name)}|${gradeToken(gradeRaw)}|${norm(teacherRaw)}`;
    let status: RowStatus;

    if (issues.length) {
      status = "error"; errors++;
    } else if (seen.has(dupKey)) {
      status = "duplicate"; duplicates++;
      issues.push("Duplicate of an earlier row");
    } else {
      seen.add(dupKey);
      if (!studentMatch) newStudents++; else matchedStudents++;
      if (teacherNew) newTeacherKeys.add(`${gradeToken(gradeRaw)}|${norm(teacherRaw)}`);
      else if (teacherMatch) matchedTeacherIds.add(teacherMatch.id);
      if (mondayMenuMatch) {
        mondayOrders++;
        if (mondayConflict) mondayConflicts++;
      }
      if (wednesdayMenuMatch) {
        wednesdayOrders++;
        if (wednesdayConflict) wednesdayConflicts++;
      }
      // "conflict" only when there's an actual existing order to resolve
      const hasRealConflict = mondayConflict || wednesdayConflict;
      status = hasRealConflict ? "conflict" : (!studentMatch ? "new" : "matched");
    }

    out.push({
      line: i + 2,
      status,
      issues,
      studentName: name,
      gradeName: gradeRaw ? (gradeMatch?.name ?? gradeRaw) : "",
      teacherName: teacherRaw,
      deliveryLabel: deliveryRaw,
      studentNew: !studentMatch,
      teacherNew,
      gradeNew,
      deliveryNew,
      mondayMenuName: mondayMenuRaw || undefined,
      mondayMenuMatched: !!mondayMenuMatch,
      mondayConflict: mondayConflict || undefined,
      mondayExistingMealName,
      mondayResolution: mondayConflict ? "replace" : undefined,
      wednesdayMenuName: wednesdayMenuRaw || undefined,
      wednesdayMenuMatched: !!wednesdayMenuMatch,
      wednesdayConflict: wednesdayConflict || undefined,
      wednesdayExistingMealName,
      wednesdayResolution: wednesdayConflict ? "replace" : undefined,
      raw: { name, gradeRaw, teacherRaw, deliveryRaw, mondayMenuRaw, wednesdayMenuRaw },
    });
  });

  const stats: CombinedStats = {
    total: rows.length,
    valid: rows.length - errors - duplicates,
    newStudents, matchedStudents,
    newTeachers: newTeacherKeys.size,
    matchedTeachers: matchedTeacherIds.size,
    mondayOrders, wednesdayOrders,
    mondayConflicts, wednesdayConflicts,
    duplicates, errors,
    menuCount: ref.menu.length,
  };

  return { rows: out, stats };
}

// ─── Legacy exports (kept for any existing callers) ───────────────────────────
export type RosterStats = CombinedStats;
export type OrderStats = CombinedStats;
export const ROSTER_FIELDS = COMBINED_FIELDS;
export const ORDER_FIELDS = COMBINED_FIELDS;
export function analyzeRoster(rows: string[][], m: Mapping, ref: RefData) {
  return analyzeCombined(rows, m, ref, "", "");
}
export function analyzeOrders(rows: string[][], m: Mapping, ref: RefData) {
  return analyzeCombined(rows, m, ref, "", "");
}
