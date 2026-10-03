import { norm, gradeToken, gradeDisplayName, cleanName } from "./csv";
import { sendBatchRequests, BatchWriteError, type BatchProgress } from "./pocketbaseBatch";
export { BatchWriteError as ImportExecutionError } from "./pocketbaseBatch";
import type { AnalyzedRow, RefData } from "./importAnalyze";
import type { Grade, Teacher, DeliveryTime, Student, MealSelection } from "./types";

export interface ExecResult {
  imported: number;
  skipped: number;
  errors: number;
  createdStudents: number;
  createdMeals: number;
  replacedMeals: number;
}

interface Ctx { schoolId?: string }
type BatchRequest = { method: "POST" | "PATCH"; url: string; body: Record<string, unknown> };

type PreparedRow = {
  row: AnalyzedRow;
  gradeToken: string;
  teacherNorm: string;
  studentKey: string;
};

/** Execute a combined import (roster + orders in one pass) using transactional chunks. */
export async function executeCombined(
  rows: AnalyzedRow[],
  ref: RefData,
  mondayKey: string,
  wednesdayKey: string,
  ctx: Ctx,
  extraKeys: Partial<Record<"tuesday" | "thursday" | "friday", string>> = {},
): Promise<ExecResult> {
  const dateByDay: Record<string, string> = {
    monday: mondayKey,
    tuesday: extraKeys.tuesday || "",
    wednesday: wednesdayKey,
    thursday: extraKeys.thursday || "",
    friday: extraKeys.friday || "",
  };
  const res: ExecResult = { imported: 0, skipped: 0, errors: 0, createdStudents: 0, createdMeals: 0, replacedMeals: 0 };
  const committed: BatchProgress = { count: 0, records: 0 };
  const validRows: PreparedRow[] = [];
  const gradeByToken = new Map<string, Grade>();
  ref.grades.forEach((grade) => gradeByToken.set(gradeToken(grade.name), grade));

  const teacherByKey = new Map<string, Teacher>();
  ref.teachers.forEach((teacher) => teacherByKey.set(`${teacher.grade}|${norm(teacher.name)}`, teacher));
  const timeByNorm = new Map<string, DeliveryTime>();
  ref.times.forEach((time) => timeByNorm.set(norm(time.label), time));
  const menuById = new Map(ref.menu.map((menu) => [menu.id, menu]));
  const menuByNorm = new Map(ref.menu.map((menu) => [norm(menu.name), menu]));

  const gradeIdByToken = new Map<string, string>();
  ref.grades.forEach((grade) => gradeIdByToken.set(gradeToken(grade.name), grade.id));
  const teacherIdByKey = new Map<string, string>();
  ref.teachers.forEach((teacher) => teacherIdByKey.set(`${teacher.grade}|${norm(teacher.name)}`, teacher.id));
  const studentByKey = new Map<string, Student>();
  const gradeById = new Map(ref.grades.map((grade) => [grade.id, grade]));
  const teacherById = new Map(ref.teachers.map((teacher) => [teacher.id, teacher]));
  ref.students.forEach((student) => {
    const grade = gradeById.get(student.grade);
    const teacher = teacherById.get(student.teacher);
    studentByKey.set(`${norm(student.name)}|${gradeToken(grade?.name || "")}|${norm(teacher?.name || "")}`, student);
  });
  const selectionByKey = new Map<string, MealSelection>();
  ref.selections.forEach((selection) => {
    const date = selection.lunch_date?.slice(0, 10);
    if (date) selectionByKey.set(`${selection.student}|${date}`, selection);
  });
  const ruleByTeacher = new Map<string, string>();
  const ruleByGrade = new Map<string, string>();
  ref.rules.forEach((rule) => {
    if (rule.teacher) ruleByTeacher.set(rule.teacher, rule.delivery_time);
    else ruleByGrade.set(rule.grade, rule.delivery_time);
  });

  for (const row of rows) {
    if (row.status === "error") { res.errors++; continue; }
    if (row.status === "duplicate") { res.skipped++; continue; }
    const gToken = gradeToken(row.raw.gradeRaw);
    const tNorm = norm(row.raw.teacherRaw);
    validRows.push({ row, gradeToken: gToken, teacherNorm: tNorm, studentKey: `${norm(row.raw.name)}|${gToken}|${tNorm}` });
  }

  const maxGradeOrder = Math.max(0, ...ref.grades.map((grade) => grade.sort_order || 0));
  const missingGrades = [...new Set(validRows.map((item) => item.gradeToken))]
    .filter((token) => !gradeIdByToken.has(token));
  const gradeRequests: BatchRequest[] = missingGrades.map((token, index) => {
    const raw = validRows.find((item) => item.gradeToken === token)!.row.raw.gradeRaw;
    return { method: "POST", url: "/api/collections/grades/records", body: {
      name: gradeDisplayName(raw), sort_order: maxGradeOrder + index + 1, active: true, school: ctx.schoolId,
    } };
  });
  const newGrades = await sendBatchRequests<Grade>(gradeRequests, "Grade setup", committed);
  newGrades.forEach((grade) => {
    gradeByToken.set(gradeToken(grade.name), grade);
    gradeIdByToken.set(gradeToken(grade.name), grade.id);
  });

  const missingTeachers = new Map<string, { gradeId: string; name: string; norm: string }>();
  for (const item of validRows) {
    const gradeId = gradeIdByToken.get(item.gradeToken)!;
    const key = `${gradeId}|${item.teacherNorm}`;
    if (!teacherIdByKey.has(key) && !missingTeachers.has(key)) {
      missingTeachers.set(key, { gradeId, name: cleanName(item.row.raw.teacherRaw), norm: item.teacherNorm });
    }
  }
  const teacherRequests: BatchRequest[] = [...missingTeachers.entries()].map(([, teacher]) => ({
    method: "POST", url: "/api/collections/teachers/records", body: {
      name: teacher.name, grade: teacher.gradeId, active: true, school: ctx.schoolId,
    },
  }));
  const newTeachers = await sendBatchRequests<Teacher>(teacherRequests, "Teacher setup", committed);
  newTeachers.forEach((teacher) => {
    const key = `${teacher.grade}|${norm(teacher.name)}`;
    teacherByKey.set(key, teacher);
    teacherIdByKey.set(key, teacher.id);
  });

  const timeLabels = [...new Set(validRows.map((item) => item.row.raw.deliveryRaw?.trim() || "").filter(Boolean))];
  const maxTimeOrder = Math.max(0, ...ref.times.map((time) => time.sort_order || 0));
  const missingTimes = [...new Map(timeLabels
    .filter((label) => !timeByNorm.has(norm(label)))
    .map((label) => [norm(label), label])).values()];
  const timeRequests: BatchRequest[] = missingTimes.map((label, index) => ({
    method: "POST", url: "/api/collections/delivery_time_slots/records", body: {
      label: cleanName(label), sort_order: maxTimeOrder + index + 1, active: true, school: ctx.schoolId,
    },
  }));
  const newTimes = await sendBatchRequests<DeliveryTime>(timeRequests, "Delivery time setup", committed);
  newTimes.forEach((time) => timeByNorm.set(norm(time.label), time));

  const newRules = new Map<string, { gradeId: string; teacherId: string; timeId: string }>();
  for (const item of validRows) {
    const gradeId = gradeIdByToken.get(item.gradeToken)!;
    const teacherId = teacherIdByKey.get(`${gradeId}|${item.teacherNorm}`)!;
    const rawTime = item.row.raw.deliveryRaw?.trim() || "";
    const timeId = rawTime ? timeByNorm.get(norm(rawTime))?.id : undefined;
    if (timeId && !ruleByTeacher.has(teacherId) && !newRules.has(teacherId)) {
      newRules.set(teacherId, { gradeId, teacherId, timeId });
    }
  }
  const ruleRequests: BatchRequest[] = [...newRules.values()].map((rule) => ({
    method: "POST", url: "/api/collections/delivery_rules/records", body: {
      grade: rule.gradeId, teacher: rule.teacherId, delivery_time: rule.timeId, school: ctx.schoolId,
    },
  }));
  await sendBatchRequests(ruleRequests, "Delivery rule setup", committed);
  newRules.forEach((rule, teacherId) => ruleByTeacher.set(teacherId, rule.timeId));

  const missingStudents = new Map<string, { name: string; gradeId: string; teacherId: string }>();
  for (const item of validRows) {
    if (studentByKey.has(item.studentKey) || missingStudents.has(item.studentKey)) continue;
    const gradeId = gradeIdByToken.get(item.gradeToken)!;
    const teacherId = teacherIdByKey.get(`${gradeId}|${item.teacherNorm}`)!;
    missingStudents.set(item.studentKey, { name: cleanName(item.row.raw.name), gradeId, teacherId });
  }
  const studentRequests: BatchRequest[] = [...missingStudents.values()].map((student) => ({
    method: "POST", url: "/api/collections/students/records", body: {
      name: student.name, grade: student.gradeId, teacher: student.teacherId, active: true, school: ctx.schoolId,
    },
  }));
  const newStudents = await sendBatchRequests<Student>(studentRequests, "Student roster", committed);
  const missingKeys = [...missingStudents.keys()];
  newStudents.forEach((student, index) => {
    const key = missingKeys[index];
    if (key) studentByKey.set(key, student);
    res.createdStudents++;
  });

  const mealRequests: BatchRequest[] = [];
  const mealEffects: Array<"created" | "replaced"> = [];
  const days: Array<{ field: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" }> = [
    { field: "monday" }, { field: "tuesday" }, { field: "wednesday" },
    { field: "thursday" }, { field: "friday" },
  ];

  for (const item of validRows) {
    const row = item.row;
    const student = studentByKey.get(item.studentKey);
    if (!student) throw new BatchWriteError("Could not resolve an imported student.", "Meal selections", committed.count, committed.records || 0);
    const gradeId = gradeIdByToken.get(item.gradeToken)!;
    const teacherId = teacherIdByKey.get(`${gradeId}|${item.teacherNorm}`)!;
    const rawDelivery = row.raw.deliveryRaw?.trim() || "";
    const deliveryId = rawDelivery
      ? timeByNorm.get(norm(rawDelivery))?.id || null
      : ruleByTeacher.get(teacherId) || ruleByGrade.get(gradeId) || null;

    for (const { field } of days) {
      const date = dateByDay[field];
      const mealName = row[`${field}MenuName` as keyof AnalyzedRow] as string | undefined;
      if (!date || !mealName) continue;
      const menuId = row[`${field}MenuId` as keyof AnalyzedRow] as string | undefined;
      const rawMeal = row.raw[`${field}MenuRaw` as keyof typeof row.raw] as string | undefined;
      const menu = (menuId && menuById.get(menuId)) || menuByNorm.get(norm(rawMeal || ""));
      if (!menu) continue;

      const existing = selectionByKey.get(`${student.id}|${date}`);
      const resolutionKey = `${field}Resolution` as keyof AnalyzedRow;
      const resolution = (row[resolutionKey] as "keep" | "replace" | "add" | undefined) || "keep";
      const body = {
        student: student.id, delivery_time: deliveryId, parent: student.parent || null,
        school: ctx.schoolId, lunch_date: `${date}T12:00:00.000Z`, menu_item: menu.id,
      };

      if (existing) {
        if (resolution === "replace") {
          mealRequests.push({ method: "PATCH", url: `/api/collections/meal_selections/records/${existing.id}`, body });
          mealEffects.push("replaced");
        } else if (resolution === "add") {
          mealRequests.push({ method: "POST", url: "/api/collections/meal_selections/records", body });
          mealEffects.push("created");
        } else {
          res.skipped++;
        }
      } else {
        mealRequests.push({ method: "POST", url: "/api/collections/meal_selections/records", body });
        mealEffects.push("created");
      }
    }
    if (missingStudents.has(item.studentKey)) res.imported++;
    else res.skipped++;
  }

  await sendBatchRequests(mealRequests, "Meal selections", committed);
  mealEffects.forEach((effect) => {
    if (effect === "created") { res.createdMeals++; res.imported++; }
    else { res.replacedMeals++; res.imported++; }
  });

  return res;
}

// Legacy shims
export async function executeRoster(rows: AnalyzedRow[], ref: RefData, ctx: Ctx) {
  return executeCombined(rows, ref, "", "", ctx);
}
export async function executeOrders(rows: AnalyzedRow[], ref: RefData, ctx: Ctx) {
  return executeCombined(rows, ref, "", "", ctx);
}
