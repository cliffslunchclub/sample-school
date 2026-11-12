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

/** Single combined template — one row per student, five optional meal columns. */
export const COMBINED_FIELDS: FieldDef[] = [
  { key: "student_name",  label: "Student Name",              required: true,  keywords: ["student name", "student", "name", "child"] },
  { key: "grade",         label: "Grade",                     required: false, keywords: ["grade level", "grade"] },
  { key: "teacher",       label: "Teacher",                   required: false, keywords: ["teacher", "homeroom"] },
  { key: "grade_teacher", label: "Grade/Teacher (combined)",  required: false, keywords: ["grade/teacher", "grade-teacher", "classroom", "class"] },
  { key: "delivery_time", label: "Delivery Time",             required: false, keywords: ["delivery time", "delivery", "time"] },
  { key: "monday_meal",   label: "Monday Meal",               required: false, keywords: ["monday meal", "monday", "mon meal", "mon"] },
  { key: "tuesday_meal", label: "Tuesday Meal", required: false, keywords: ["tuesday meal", "tuesday", "tue"] },
  { key: "thursday_meal", label: "Thursday Meal", required: false, keywords: ["thursday meal", "thursday", "thu"] },
  { key: "friday_meal", label: "Friday Meal", required: false, keywords: ["friday meal", "friday", "fri"] },
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
  mondayMenuId?: string;
  mondayMenuMatched?: boolean;
  mondayConflict?: boolean;
  mondayExistingMealName?: string;
  mondayResolution?: "keep" | "replace" | "add";
  tuesdayMenuName?: string;
  tuesdayMenuId?: string;
  tuesdayMenuMatched?: boolean;
  tuesdayConflict?: boolean;
  tuesdayExistingMealName?: string;
  tuesdayResolution?: "keep" | "replace" | "add";
  thursdayMenuName?: string;
  thursdayMenuId?: string;
  thursdayMenuMatched?: boolean;
  thursdayConflict?: boolean;
  thursdayExistingMealName?: string;
  thursdayResolution?: "keep" | "replace" | "add";
  fridayMenuName?: string;
  fridayMenuId?: string;
  fridayMenuMatched?: boolean;
  fridayConflict?: boolean;
  fridayExistingMealName?: string;
  fridayResolution?: "keep" | "replace" | "add";
  wednesdayMenuName?: string;
  wednesdayMenuId?: string;
  wednesdayMenuMatched?: boolean;
  wednesdayConflict?: boolean;
  wednesdayExistingMealName?: string;
  wednesdayResolution?: "keep" | "replace" | "add";
  raw: {
    name: string; gradeRaw: string; teacherRaw: string; deliveryRaw: string;
    mondayMenuRaw?: string; wednesdayMenuRaw?: string; tuesdayMenuRaw?: string; thursdayMenuRaw?: string; fridayMenuRaw?: string;
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
  tuesdayOrders: number;
  thursdayOrders: number;
  fridayOrders: number;

  wednesdayOrders: number;
  mondayConflicts: number;
  tuesdayConflicts: number;
  thursdayConflicts: number;
  fridayConflicts: number;

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
    if (s.recurring_weekday === "Monday") selByKey.set(`${s.student}|__recurring_monday__|${s.menu_item}|${s.delivery_time || ""}`, s);
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
  extraKeys: Partial<Record<"tuesday" | "thursday" | "friday", string>> = {},
): { rows: AnalyzedRow[]; stats: CombinedStats } {
  const tuesdayKey = extraKeys.tuesday || "";
  const thursdayKey = extraKeys.thursday || "";
  const fridayKey = extraKeys.friday || "";
  const ix = buildIndexes(ref);
  const recurring = mondayKey === "__recurring_monday__";
  const seen = new Set<string>();
  const seenStudents = new Set<string>();
  const newTeacherKeys = new Set<string>();
  const matchedTeacherIds = new Set<string>();
  const out: AnalyzedRow[] = [];
  let newStudents = 0, matchedStudents = 0, duplicates = 0, errors = 0;
  let mondayOrders = 0, wednesdayOrders = 0;
  let tuesdayOrders = 0;
  let thursdayOrders = 0;
  let fridayOrders = 0;
  let mondayConflicts = 0, wednesdayConflicts = 0;
  let tuesdayConflicts = 0;
  let thursdayConflicts = 0;
  let fridayConflicts = 0;

  rows.forEach((row, i) => {
    const name = cleanName(get(row, m.student_name ?? -1));
    const { gradeRaw, teacherRaw } = resolveGradeTeacher(row, m);
    const deliveryRaw = cleanName(get(row, m.delivery_time ?? -1));
    const mondayMenuRaw = cleanName(get(row, m.monday_meal ?? -1));
    const tuesdayMenuRaw = cleanName(get(row, m.tuesday_meal ?? -1));
    const thursdayMenuRaw = cleanName(get(row, m.thursday_meal ?? -1));
    const fridayMenuRaw = cleanName(get(row, m.friday_meal ?? -1));
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
    const tuesdayMenuMatch = tuesdayMenuRaw ? fuzzyFindMenu(tuesdayMenuRaw, ix.menuByNorm) : undefined;
    const thursdayMenuMatch = thursdayMenuRaw ? fuzzyFindMenu(thursdayMenuRaw, ix.menuByNorm) : undefined;
    const fridayMenuMatch = fridayMenuRaw ? fuzzyFindMenu(fridayMenuRaw, ix.menuByNorm) : undefined;
    const wednesdayMenuMatch = wednesdayMenuRaw ? fuzzyFindMenu(wednesdayMenuRaw, ix.menuByNorm) : undefined;

    if (mondayMenuRaw && !mondayKey) issues.push("No Monday date in the selected semester");
    if (recurring && (tuesdayMenuRaw || wednesdayMenuRaw || thursdayMenuRaw || fridayMenuRaw)) issues.push("CHS recurring imports accept Monday meals only");
    if (mondayMenuMatch && (!mondayMenuMatch.active || !mondayMenuMatch.days?.includes("Monday"))) issues.push("Selected meal is not available on Monday");
    if (tuesdayMenuRaw && !tuesdayKey) issues.push("No Tuesday date in the selected semester");
    if (tuesdayMenuMatch && (!tuesdayMenuMatch.active || !tuesdayMenuMatch.days?.includes("Tuesday"))) issues.push("Selected meal is not available on Tuesday");
    if (wednesdayMenuRaw && !wednesdayKey) issues.push("No Wednesday date in the selected semester");
    if (wednesdayMenuMatch && (!wednesdayMenuMatch.active || !wednesdayMenuMatch.days?.includes("Wednesday"))) issues.push("Selected meal is not available on Wednesday");
    if (thursdayMenuRaw && !thursdayKey) issues.push("No Thursday date in the selected semester");
    if (thursdayMenuMatch && (!thursdayMenuMatch.active || !thursdayMenuMatch.days?.includes("Thursday"))) issues.push("Selected meal is not available on Thursday");
    if (fridayMenuRaw && !fridayKey) issues.push("No Friday date in the selected semester");
    if (fridayMenuMatch && (!fridayMenuMatch.active || !fridayMenuMatch.days?.includes("Friday"))) issues.push("Selected meal is not available on Friday");

    // Conflict detection per day
    let mondayConflict = false, wednesdayConflict = false;
    let tuesdayConflict = false;
    let thursdayConflict = false;
    let fridayConflict = false;
    let mondayExistingMealName: string | undefined, wednesdayExistingMealName: string | undefined;
    let tuesdayExistingMealName: string | undefined;
    let thursdayExistingMealName: string | undefined;
    let fridayExistingMealName: string | undefined;
    if (studentMatch) {
      if (mondayMenuMatch) {
        const deliveryId = ix.timeByNorm.get(norm(deliveryRaw))?.id || "";
        const ex = recurring
          ? ix.selByKey.get(`${studentMatch.id}|__recurring_monday__|${mondayMenuMatch.id}|${deliveryId}`)
          : ix.selByKey.get(`${studentMatch.id}|${mondayKey}`);
        if (ex) {
          mondayConflict = true;
          mondayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
        }
      }
      if (tuesdayMenuMatch) {
        const ex = ix.selByKey.get(`${studentMatch.id}|${tuesdayKey}`);
        if (ex) {
          tuesdayConflict = true;
          tuesdayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
        }
      }
      if (thursdayMenuMatch) {
        const ex = ix.selByKey.get(`${studentMatch.id}|${thursdayKey}`);
        if (ex) {
          thursdayConflict = true;
          thursdayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
        }
      }
      if (fridayMenuMatch) {
        const ex = ix.selByKey.get(`${studentMatch.id}|${fridayKey}`);
        if (ex) {
          fridayConflict = true;
          fridayExistingMealName = ix.menuById.get(ex.menu_item)?.name ?? "existing meal";
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

    const studentKey = `${norm(name)}|${gradeToken(gradeRaw)}|${norm(teacherRaw)}`;
    // Two different lunches for one student are valid (e.g. Justin's two meals).
    // An identical repeated CSV entry is still a duplicate.
    const dupKey = recurring ? `${studentKey}|${norm(mondayMenuRaw)}|${norm(deliveryRaw)}` : studentKey;
    let status: RowStatus;

    if (issues.length) {
      status = "error"; errors++;
    } else if (seen.has(dupKey)) {
      status = "duplicate"; duplicates++;
      issues.push("Duplicate of an earlier row");
    } else {
      seen.add(dupKey);
      if (!seenStudents.has(studentKey)) {
        if (!studentMatch) newStudents++; else matchedStudents++;
        seenStudents.add(studentKey);
      }
      if (teacherNew) newTeacherKeys.add(`${gradeToken(gradeRaw)}|${norm(teacherRaw)}`);
      else if (teacherMatch) matchedTeacherIds.add(teacherMatch.id);
      if (mondayMenuMatch) {
        mondayOrders++;
        if (mondayConflict) mondayConflicts++;
      }
      if (tuesdayMenuMatch) {
        tuesdayOrders++;
        if (tuesdayConflict) tuesdayConflicts++;
      }
      if (thursdayMenuMatch) {
        thursdayOrders++;
        if (thursdayConflict) thursdayConflicts++;
      }
      if (fridayMenuMatch) {
        fridayOrders++;
        if (fridayConflict) fridayConflicts++;
      }
      if (wednesdayMenuMatch) {
        wednesdayOrders++;
        if (wednesdayConflict) wednesdayConflicts++;
      }
      // "conflict" only when there's an actual existing order to resolve
      const hasRealConflict = mondayConflict || wednesdayConflict || tuesdayConflict || thursdayConflict || fridayConflict;
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
      mondayMenuId: mondayMenuMatch?.id,
      mondayMenuMatched: !!mondayMenuMatch,
      mondayConflict: mondayConflict || undefined,
      mondayExistingMealName,
      mondayResolution: mondayConflict ? "replace" : undefined,
      tuesdayMenuName: tuesdayMenuRaw || undefined,
      tuesdayMenuId: tuesdayMenuMatch?.id,
      tuesdayMenuMatched: !!tuesdayMenuMatch,
      tuesdayConflict: tuesdayConflict || undefined,
      tuesdayExistingMealName,
      tuesdayResolution: tuesdayConflict ? "replace" : undefined,
      thursdayMenuName: thursdayMenuRaw || undefined,
      thursdayMenuId: thursdayMenuMatch?.id,
      thursdayMenuMatched: !!thursdayMenuMatch,
      thursdayConflict: thursdayConflict || undefined,
      thursdayExistingMealName,
      thursdayResolution: thursdayConflict ? "replace" : undefined,
      fridayMenuName: fridayMenuRaw || undefined,
      fridayMenuId: fridayMenuMatch?.id,
      fridayMenuMatched: !!fridayMenuMatch,
      fridayConflict: fridayConflict || undefined,
      fridayExistingMealName,
      fridayResolution: fridayConflict ? "replace" : undefined,
      wednesdayMenuName: wednesdayMenuRaw || undefined,
      wednesdayMenuId: wednesdayMenuMatch?.id,
      wednesdayMenuMatched: !!wednesdayMenuMatch,
      wednesdayConflict: wednesdayConflict || undefined,
      wednesdayExistingMealName,
      wednesdayResolution: wednesdayConflict ? "replace" : undefined,
      raw: { name, gradeRaw, teacherRaw, deliveryRaw, mondayMenuRaw, wednesdayMenuRaw, tuesdayMenuRaw, thursdayMenuRaw, fridayMenuRaw },
    });
  });

  const stats: CombinedStats = {
    total: rows.length,
    valid: rows.length - errors - duplicates,
    newStudents, matchedStudents,
    newTeachers: newTeacherKeys.size,
    matchedTeachers: matchedTeacherIds.size,
    mondayOrders, wednesdayOrders, tuesdayOrders, thursdayOrders, fridayOrders,
    mondayConflicts, wednesdayConflicts, tuesdayConflicts, thursdayConflicts, fridayConflicts,
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
