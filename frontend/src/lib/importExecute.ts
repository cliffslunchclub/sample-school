import pb from "./pocketbase";
import { norm, gradeToken, gradeDisplayName, cleanName } from "./csv";
import type { AnalyzedRow, RefData } from "./importAnalyze";
import type { Grade, Teacher, DeliveryTime, Student, MenuItem, MealSelection } from "./types";

export interface ExecResult {
  imported: number;
  skipped: number;
  errors: number;
  createdStudents: number;
  createdMeals: number;
  replacedMeals: number;
}

interface Ctx { schoolId?: string }

function makeEnsurers(ref: RefData, ctx: Ctx) {
  const gradeByToken = new Map<string, Grade>();
  ref.grades.forEach((g) => gradeByToken.set(gradeToken(g.name), g));
  const teacherByKey = new Map<string, Teacher>();
  ref.teachers.forEach((t) => teacherByKey.set(`${t.grade}|${norm(t.name)}`, t));
  const timeByNorm = new Map<string, DeliveryTime>();
  ref.times.forEach((t) => timeByNorm.set(norm(t.label), t));
  const menuByNorm = new Map<string, MenuItem>();
  ref.menu.forEach((mi) => menuByNorm.set(norm(mi.name), mi));
  const gradeById = new Map(ref.grades.map((g) => [g.id, g]));
  const teacherById = new Map(ref.teachers.map((t) => [t.id, t]));
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
  const ruleByTeacher = new Map<string, string>();
  const ruleByGradeOnly = new Map<string, string>();
  ref.rules.forEach((r) => {
    if (r.teacher) ruleByTeacher.set(r.teacher, r.delivery_time);
    else ruleByGradeOnly.set(r.grade, r.delivery_time);
  });
  let gradeOrder = Math.max(0, ...ref.grades.map((g) => g.sort_order || 0));
  let timeOrder  = Math.max(0, ...ref.times.map((t) => t.sort_order  || 0));

  const ensureGrade = async (raw: string): Promise<Grade> => {
    const tok = gradeToken(raw);
    const hit = gradeByToken.get(tok);
    if (hit) return hit;
    const rec = await pb.collection("grades").create<Grade>({
      name: gradeDisplayName(raw), sort_order: ++gradeOrder, active: true, school: ctx.schoolId,
    });
    gradeByToken.set(tok, rec);
    return rec;
  };

  const ensureTeacher = async (gradeId: string, raw: string): Promise<Teacher> => {
    const key = `${gradeId}|${norm(raw)}`;
    const hit = teacherByKey.get(key);
    if (hit) return hit;
    const rec = await pb.collection("teachers").create<Teacher>({
      name: cleanName(raw), grade: gradeId, active: true, school: ctx.schoolId,
    });
    teacherByKey.set(key, rec);
    return rec;
  };

  const ensureTime = async (raw: string): Promise<DeliveryTime | null> => {
    if (!raw.trim()) return null;
    const hit = timeByNorm.get(norm(raw));
    if (hit) return hit;
    const rec = await pb.collection("delivery_time_slots").create<DeliveryTime>({
      label: cleanName(raw), sort_order: ++timeOrder, active: true, school: ctx.schoolId,
    });
    timeByNorm.set(norm(raw), rec);
    return rec;
  };

  const ensureRuleForTeacher = async (gradeId: string, teacherId: string, timeId: string) => {
    if (ruleByTeacher.has(teacherId)) return;
    await pb.collection("delivery_rules").create({
      grade: gradeId, teacher: teacherId, delivery_time: timeId, school: ctx.schoolId,
    });
    ruleByTeacher.set(teacherId, timeId);
  };

  const ensureStudent = async (
    name: string, gradeId: string, teacherId: string, gradeRaw: string, teacherRaw: string,
  ) => {
    const key = `${norm(name)}|${gradeToken(gradeRaw)}|${norm(teacherRaw)}`;
    const hit = studentByKey.get(key);
    if (hit) return { student: hit, created: false };
    const rec = await pb.collection("students").create<Student>({
      name: cleanName(name), grade: gradeId, teacher: teacherId, active: true, school: ctx.schoolId,
    });
    studentByKey.set(key, rec);
    return { student: rec, created: true };
  };

  const lunchIsoFor = (dateKey: string): string =>
    `${dateKey}T12:00:00.000Z`;

  const deliveryTimeId = async (gradeId: string, teacherId: string, deliveryRaw: string) => {
    if (deliveryRaw.trim()) {
      const t = await ensureTime(deliveryRaw);
      return t?.id ?? null;
    }
    return ruleByTeacher.get(teacherId) ?? ruleByGradeOnly.get(gradeId) ?? null;
  };

  return {
    menuByNorm, selByKey,
    ensureGrade, ensureTeacher, ensureTime, ensureRuleForTeacher,
    ensureStudent, lunchIsoFor, deliveryTimeId,
  };
}

/** Execute a combined import (roster + orders in one pass). */
export async function executeCombined(
  rows: AnalyzedRow[],
  ref: RefData,
  mondayKey: string,
  wednesdayKey: string,
  ctx: Ctx,
  extraKeys: Partial<Record<"tuesday" | "thursday" | "friday", string>> = {},
): Promise<ExecResult> {
  const tuesdayKey = extraKeys.tuesday || "";
  const thursdayKey = extraKeys.thursday || "";
  const fridayKey = extraKeys.friday || "";
  const e = makeEnsurers(ref, ctx);
  const res: ExecResult = { imported: 0, skipped: 0, errors: 0, createdStudents: 0, createdMeals: 0, replacedMeals: 0 };

  for (const row of rows) {
    if (row.status === "error")     { res.errors++;  continue; }
    if (row.status === "duplicate") { res.skipped++; continue; }

    const grade   = await e.ensureGrade(row.raw.gradeRaw);
    const teacher = await e.ensureTeacher(grade.id, row.raw.teacherRaw);

    if (row.raw.deliveryRaw?.trim()) {
      const t = await e.ensureTime(row.raw.deliveryRaw);
      if (t) await e.ensureRuleForTeacher(grade.id, teacher.id, t.id);
    }

    const { student, created } = await e.ensureStudent(
      row.raw.name, grade.id, teacher.id, row.raw.gradeRaw, row.raw.teacherRaw,
    );
    if (created) res.createdStudents++;

    const deliveryId = await e.deliveryTimeId(grade.id, teacher.id, row.raw.deliveryRaw ?? "");

    const basePayload = {
      student: student.id,
      delivery_time: deliveryId,
      parent: student.parent || null,
      school: ctx.schoolId,
    };

    // ── Monday order ──────────────────────────────────────────────────────────
    if (mondayKey && row.mondayMenuName) {
      const menuItem = ref.menu.find(m => m.id === row.mondayMenuId) || e.menuByNorm.get(norm(row.raw.mondayMenuRaw ?? ""));
      if (menuItem) {
        const existing = e.selByKey.get(`${student.id}|${mondayKey}`);
        const payload = { ...basePayload, lunch_date: e.lunchIsoFor(mondayKey), menu_item: menuItem.id };
        if (existing) {
          const res_ = row.mondayResolution ?? "keep";
          if (res_ === "replace") {
            await pb.collection("meal_selections").update(existing.id, payload);
            res.replacedMeals++; res.imported++;
          } else if (res_ === "add") {
            await pb.collection("meal_selections").create<MealSelection>(payload);
            res.createdMeals++; res.imported++;
          } else {
            res.skipped++;
          }
        } else {
          const rec = await pb.collection("meal_selections").create<MealSelection>(payload);
          e.selByKey.set(`${student.id}|${mondayKey}`, rec);
          res.createdMeals++; res.imported++;
        }
      }
    }

    // ── Tuesday order ──────────────────────────────────────────────────────────
    if (tuesdayKey && row.tuesdayMenuName) {
      const menuItem = ref.menu.find(m => m.id === row.tuesdayMenuId) || e.menuByNorm.get(norm(row.raw.tuesdayMenuRaw ?? ""));
      if (menuItem) {
        const existing = e.selByKey.get(`${student.id}|${tuesdayKey}`);
        const payload = { ...basePayload, lunch_date: e.lunchIsoFor(tuesdayKey), menu_item: menuItem.id };
        if (existing) {
          const res_ = row.tuesdayResolution ?? "keep";
          if (res_ === "replace") {
            await pb.collection("meal_selections").update(existing.id, payload);
            res.replacedMeals++; res.imported++;
          } else if (res_ === "add") {
            await pb.collection("meal_selections").create<MealSelection>(payload);
            res.createdMeals++; res.imported++;
          } else {
            res.skipped++;
          }
        } else {
          const rec = await pb.collection("meal_selections").create<MealSelection>(payload);
          e.selByKey.set(`${student.id}|${tuesdayKey}`, rec);
          res.createdMeals++; res.imported++;
        }
      }
    }

    // ── Thursday order ──────────────────────────────────────────────────────────
    if (thursdayKey && row.thursdayMenuName) {
      const menuItem = ref.menu.find(m => m.id === row.thursdayMenuId) || e.menuByNorm.get(norm(row.raw.thursdayMenuRaw ?? ""));
      if (menuItem) {
        const existing = e.selByKey.get(`${student.id}|${thursdayKey}`);
        const payload = { ...basePayload, lunch_date: e.lunchIsoFor(thursdayKey), menu_item: menuItem.id };
        if (existing) {
          const res_ = row.thursdayResolution ?? "keep";
          if (res_ === "replace") {
            await pb.collection("meal_selections").update(existing.id, payload);
            res.replacedMeals++; res.imported++;
          } else if (res_ === "add") {
            await pb.collection("meal_selections").create<MealSelection>(payload);
            res.createdMeals++; res.imported++;
          } else {
            res.skipped++;
          }
        } else {
          const rec = await pb.collection("meal_selections").create<MealSelection>(payload);
          e.selByKey.set(`${student.id}|${thursdayKey}`, rec);
          res.createdMeals++; res.imported++;
        }
      }
    }

    // ── Friday order ──────────────────────────────────────────────────────────
    if (fridayKey && row.fridayMenuName) {
      const menuItem = ref.menu.find(m => m.id === row.fridayMenuId) || e.menuByNorm.get(norm(row.raw.fridayMenuRaw ?? ""));
      if (menuItem) {
        const existing = e.selByKey.get(`${student.id}|${fridayKey}`);
        const payload = { ...basePayload, lunch_date: e.lunchIsoFor(fridayKey), menu_item: menuItem.id };
        if (existing) {
          const res_ = row.fridayResolution ?? "keep";
          if (res_ === "replace") {
            await pb.collection("meal_selections").update(existing.id, payload);
            res.replacedMeals++; res.imported++;
          } else if (res_ === "add") {
            await pb.collection("meal_selections").create<MealSelection>(payload);
            res.createdMeals++; res.imported++;
          } else {
            res.skipped++;
          }
        } else {
          const rec = await pb.collection("meal_selections").create<MealSelection>(payload);
          e.selByKey.set(`${student.id}|${fridayKey}`, rec);
          res.createdMeals++; res.imported++;
        }
      }
    }

    // ── Wednesday order ───────────────────────────────────────────────────────
    if (wednesdayKey && row.wednesdayMenuName) {
      const menuItem = ref.menu.find(m => m.id === row.wednesdayMenuId) || e.menuByNorm.get(norm(row.raw.wednesdayMenuRaw ?? ""));
      if (menuItem) {
        const existing = e.selByKey.get(`${student.id}|${wednesdayKey}`);
        const payload = { ...basePayload, lunch_date: e.lunchIsoFor(wednesdayKey), menu_item: menuItem.id };
        if (existing) {
          const res_ = row.wednesdayResolution ?? "keep";
          if (res_ === "replace") {
            await pb.collection("meal_selections").update(existing.id, payload);
            res.replacedMeals++; res.imported++;
          } else if (res_ === "add") {
            await pb.collection("meal_selections").create<MealSelection>(payload);
            res.createdMeals++; res.imported++;
          } else {
            res.skipped++;
          }
        } else {
          const rec = await pb.collection("meal_selections").create<MealSelection>(payload);
          e.selByKey.set(`${student.id}|${wednesdayKey}`, rec);
          res.createdMeals++; res.imported++;
        }
      }
    }

    // Count the student row itself
    if (!created) res.skipped++;
    else res.imported++;
  }

  return res;
}

// Legacy shims
export async function executeRoster(rows: AnalyzedRow[], ref: RefData, ctx: Ctx) {
  return executeCombined(rows, ref, "", "", ctx);
}
export async function executeOrders(rows: AnalyzedRow[], ref: RefData, ctx: Ctx) {
  return executeCombined(rows, ref, "", "", ctx);
}
