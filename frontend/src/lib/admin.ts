import pb from "./pocketbase";
import { dayFilter, isoForKey } from "./semester";
import type { DeliveryRule, Student } from "./types";

export function deriveDeliveryTime(student: Student, rules: DeliveryRule[]): string {
  const byTeacher = rules.find((r) => r.teacher && r.teacher === student.teacher);
  if (byTeacher) return byTeacher.delivery_time;
  const byGrade = rules.find((r) => r.grade === student.grade && !r.teacher);
  return byGrade?.delivery_time ?? "";
}

/**
 * Admin action: set (create or replace) a student's meal for a lunch date and
 * record an immutable audit entry. Bypasses the ordering window via admin rules.
 */
export async function adminSetMeal(opts: {
  student: Student;
  lunchKey: string;
  newMenuItem: string;
  deliveryTimeId?: string;
  reason: string;
  adminId: string;
  schoolId?: string;
  rules: DeliveryRule[];
}) {
  const { student, lunchKey, newMenuItem, reason, adminId, schoolId, rules } = opts;
  const lunchIso = isoForKey(lunchKey);

  let existing = null;
  try {
    existing = await pb
      .collection("meal_selections")
      .getFirstListItem(`student = "${student.id}" && ${dayFilter("lunch_date", lunchKey)}`, { requestKey: null });
  } catch {
    existing = null;
  }

  const previousMeal = existing ? existing.menu_item : "";
  const deliveryTime = opts.deliveryTimeId || deriveDeliveryTime(student, rules);

  const payload = {
    student: student.id,
    lunch_date: lunchIso,
    menu_item: newMenuItem,
    delivery_time: deliveryTime,
    parent: student.parent || null,
    school: schoolId,
  };

  if (existing) {
    await pb.collection("meal_selections").update(existing.id, payload);
  } else {
    await pb.collection("meal_selections").create(payload);
  }

  await pb.collection("audit_log").create({
    student: student.id,
    lunch_date: lunchIso,
    previous_meal: previousMeal || null,
    new_meal: newMenuItem,
    admin: adminId,
    action: existing ? "meal_override" : "meal_create",
    reason,
    school: schoolId,
  });
}
