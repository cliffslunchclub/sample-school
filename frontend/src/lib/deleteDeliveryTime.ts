import pb from "./pocketbase";
import { sendBatchRequests, type BatchRequest, type BatchProgress } from "./pocketbaseBatch";
import type { DeliveryRule, MealSelection } from "./types";

export type TimeUsage = {
  orders: Pick<MealSelection, "id" | "lunch_date" | "recurring_weekday">[];
  rules: Pick<DeliveryRule, "id">[];
};

export async function getTimeUsage(timeId: string): Promise<TimeUsage> {
  const filter = `delivery_time = "${timeId}"`;
  const [orders, rules] = await Promise.all([
    pb.collection("meal_selections").getFullList<TimeUsage["orders"][number]>({
      filter,
      fields: "id,lunch_date,recurring_weekday",
      requestKey: null,
    }),
    pb.collection("delivery_rules").getFullList<TimeUsage["rules"][number]>({
      filter,
      fields: "id",
      requestKey: null,
    }),
  ]);
  return { orders, rules };
}

/** Build a safe and auditable list of reassignment operations before deleting a slot. */
export function buildTimeReassignmentRequests(usage: TimeUsage, replacementId: string): BatchRequest[] {
  if (!replacementId) throw new Error("Choose a replacement delivery time.");
  return [
    ...usage.orders.map(o => ({
      method: "PATCH" as const,
      url: `/api/collections/meal_selections/records/${o.id}`,
      body: { delivery_time: replacementId },
    })),
    ...usage.rules.map(r => ({
      method: "PATCH" as const,
      url: `/api/collections/delivery_rules/records/${r.id}`,
      body: { delivery_time: replacementId },
    })),
  ];
}

/**
 * The deletion is last: partial failures never remove the original slot.
 * Read the live references again immediately before and after moving them.
 * Historical orders are moved only after the admin explicitly accepts the
 * confirmation warning, not when a slot is merely deactivated.
 */
export async function removeDeliveryTime(timeId: string, replacementId: string): Promise<{
  reassignedOrders: number;
  reassignedRules: number;
}> {
  if (timeId === replacementId) throw new Error("Choose a different time slot.");
  const usage = await getTimeUsage(timeId);
  if (usage.orders.length || usage.rules.length) {
    if (!replacementId) throw new Error("This time slot is in use. Choose a replacement or deactivate it.");
    const replacement = await pb.collection("delivery_time_slots").getOne<{ id: string; active: boolean }>(
      replacementId,
      { requestKey: null },
    );
    if (!replacement.active) throw new Error("The replacement time slot must be active.");
    const progress: BatchProgress = { count: 0, records: 0 };
    await sendBatchRequests(buildTimeReassignmentRequests(usage, replacementId), "Time slot reassignment", progress);
  }

  const remaining = await getTimeUsage(timeId);
  if (remaining.orders.length || remaining.rules.length) {
    throw new Error("The slot is still in use. No deletion occurred. Refresh and retry.");
  }
  await pb.collection("delivery_time_slots").delete(timeId, { requestKey: null });
  return { reassignedOrders: usage.orders.length, reassignedRules: usage.rules.length };
}
