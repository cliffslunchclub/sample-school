import { useEffect, useMemo, useState } from "react";
import { isSampleSite } from "../../lib/site";
import RecurringMondaySelection from "./RecurringMondaySelection";
import { CalendarDays, Lock, CheckCircle2, User, Save, RotateCcw } from "lucide-react";
import pb from "../../lib/pocketbase";
import { useAuth } from "../../lib/auth";
import { useToast, Button, Card, Select, EmptyState, Spinner, Badge } from "../../components/ui";
import { PageHeader } from "../../components/PageHeader";
import { orderingDayText, weekdayOf, editableLunchDates, isoForKey, keyOf, orderingWindow } from "../../lib/semester";
import { useSemester } from "../../lib/SemesterContext";
import type { Student, MenuItem, DeliveryRule, MealSelection as Sel } from "../../lib/types";

export default function MealSelection() {
  return isSampleSite ? <DatedMealSelection /> : <RecurringMondaySelection />;
}

function DatedMealSelection() {
  const { user } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [rules, setRules] = useState<DeliveryRule[]>([]);
  const [selections, setSelections] = useState<Sel[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [carriedFrom, setCarriedFrom] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { start, end, orderingDays, loading: calendarLoading } = useSemester();
  const allowedDaysText = orderingDayText(orderingDays);
  const todayKey = new Intl.DateTimeFormat("en-CA", {timeZone:"America/New_York"}).format(new Date());
  const dates = useMemo(() => editableLunchDates(new Date(), start, end, orderingDays), [start, end, orderingDays, todayKey]);
  const windowOpen = orderingWindow(new Date(), orderingDays).open && dates.length > 0;
  const selKey = (studentId: string, dayKey: string) => `${studentId}_${dayKey}`;

  const load = async () => {
    const [st, mi, dr, sel] = await Promise.all([
      pb.collection("students").getFullList<Student>({
        filter: `parent = "${user!.id}" && active = true`,
        expand: "grade,teacher",
        sort: "name",
        requestKey: null,
      }),
      pb.collection("menu_items").getFullList<MenuItem>({ filter: "active = true", sort: "name", requestKey: null }),
      pb.collection("delivery_rules").getFullList<DeliveryRule>({ requestKey: null }),
      pb.collection("meal_selections").getFullList<Sel>({ filter: `parent = "${user!.id}"`, expand: "menu_item", requestKey: null }),
    ]);
    setStudents(st);
    setMenu(mi);
    setRules(dr);
    setSelections(sel);

    // Build draft from confirmed selections
    const d: Record<string, string> = {};
    sel.forEach((s) => (d[selKey(s.student, keyOf(s.lunch_date))] = s.menu_item));

    // Carry forward the most-recent same-weekday selection into unconfirmed editable slots
    const activeMenuIds = new Set(mi.map((m) => m.id));
    const carried: Record<string, string> = {};
    if (windowOpen) {
      for (const student of st) {
        const studentSels = sel.filter((s) => s.student === student.id);
        for (const day of dates) {
          const k = selKey(student.id, day.key);
          if (d[k]) continue; // already has a confirmed selection for this date
          const recent = studentSels
            .filter((s) => {
              const dk = keyOf(s.lunch_date);
              if (dk >= day.key) return false;
              const utcDow = new Date(`${dk}T12:00:00Z`).getUTCDay();
              return utcDow === new Date(day.iso).getUTCDay();
            })
            .sort((a, b) => b.lunch_date.localeCompare(a.lunch_date))[0];
          if (recent && activeMenuIds.has(recent.menu_item) && mi.find(m => m.id === recent.menu_item)?.days?.includes(day.weekday)) {
            d[k] = recent.menu_item;
            carried[k] = "previous week";
          }
        }
      }
    }

    setDraft(d);
    setCarriedFrom(carried);
    setLoading(false);
  };

  useEffect(() => {
    if (!calendarLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, orderingDays, calendarLoading, todayKey]);

  const menuById = useMemo(() => Object.fromEntries(menu.map((m) => [m.id, m])), [menu]);
  const existingByKey = useMemo(() => {
    const map: Record<string, Sel> = {};
    selections.forEach((s) => (map[selKey(s.student, keyOf(s.lunch_date))] = s));
    return map;
  }, [selections]);

  const deriveDeliveryTime = (student: Student): string => {
    const byTeacher = rules.find((r) => r.teacher && r.teacher === student.teacher);
    if (byTeacher) return byTeacher.delivery_time;
    const byGrade = rules.find((r) => r.grade === student.grade && !r.teacher);
    return byGrade?.delivery_time ?? "";
  };

  const setDraftValue = (studentId: string, dayKey: string, val: string) => {
    setDraft((d) => ({ ...d, [selKey(studentId, dayKey)]: val }));
    const k = selKey(studentId, dayKey);
    setCarriedFrom((c) => { const n = { ...c }; delete n[k]; return n; });
  };

  const saveAll = async () => {
    setSaving(true);
    let changed = 0;
    try {
      for (const s of students) {
        for (const day of dates) {
          const k = selKey(s.id, day.key);
          const val = draft[k] || "";
          const existing = existingByKey[k];
          if (!val) continue;
          if (existing && existing.menu_item === val) continue;
          const payload = {
            student: s.id,
            lunch_date: isoForKey(day.key),
            menu_item: val,
            delivery_time: deriveDeliveryTime(s),
            parent: user!.id,
            school: user!.school,
          };
          if (existing) {
            await pb.collection("meal_selections").update(existing.id, payload);
          } else {
            await pb.collection("meal_selections").create(payload);
          }
          changed++;
        }
      }
      await load();
      toast(changed > 0 ? `Saved ${changed} selection${changed > 1 ? "s" : ""}` : "Everything is already up to date");
    } catch {
      toast("Could not save selections", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || calendarLoading) return <Spinner label="Loading meals…" />;

  if (students.length === 0) {
    return (
      <div>
        <PageHeader title="Meal Selection" desc="Choose meals for the upcoming week" />
        <EmptyState
          icon={<User className="h-7 w-7" />}
          title="Add a student first"
          desc="Head to My Students to add a child, then come back to pick their meals."
        />
      </div>
    );
  }

  const upcoming = selections.slice().sort((a, b) => a.lunch_date.localeCompare(b.lunch_date));

  return (
    <div className="pb-4">
      <PageHeader
        title="Meal Selection"
        desc={windowOpen ? "Pick a meal for each child for next week" : "Ordering is currently closed"}
        action={
          windowOpen ? (
            <Button onClick={saveAll} size="lg" loading={saving}>
              <Save className="h-5 w-5" /> Save Selections
            </Button>
          ) : undefined
        }
      />

      {!windowOpen ? (
        <>
          <Card className="mb-5 border-sun-400/40 bg-sun-100/50 p-4">
            <div className="flex items-start gap-2.5 text-sm font-bold text-[oklch(0.42_0.1_60)]">
              <Lock className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                {orderingDays.length ? <>Ordering is open on <strong>{allowedDaysText}</strong> each week for the following Monday through Friday. Previous selections are suggested — review and save during the next ordering window.</> : <>Parent ordering is currently closed by your school. You can still review your existing orders.</>}
              </span>
            </div>
          </Card>

          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No meals selected yet" desc={orderingDays.length ? `Place next week's order on ${allowedDaysText}.` : "Your school has closed parent ordering."} />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-line">
                {upcoming.map((o) => {
                  const st = students.find((s) => s.id === o.student);
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                      <div>
                        <p className="font-bold text-ink">{st?.name ?? "Student"}</p>
                        <p className="text-xs text-ink-faint">{weekdayOf(o.lunch_date)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <CheckCircle2 className="h-4 w-4 text-leaf-600" />
                        {o.expand?.menu_item?.name ?? menuById[o.menu_item]?.name ?? "Selected"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="mb-5 border-leaf-400/40 bg-leaf-50/70 p-4">
            <div className="flex items-start gap-2.5 text-sm font-bold text-leaf-700">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Ordering is open. Meals are carried over from last week — review and update if needed,
                then hit <strong>Save Selections</strong>.
              </span>
            </div>
          </Card>

          <div className="space-y-5">
            {students.map((s) => (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line bg-leaf-50/60 px-5 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-leaf-600 text-white">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold uppercase tracking-wide text-ink">{s.name}</p>
                    <p className="text-sm text-ink-soft">
                      {s.expand?.grade?.name} — {s.expand?.teacher?.name}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-line">
                  {dates.map((day) => {
                    const k = selKey(s.id, day.key);
                    const current = draft[k] || "";
                    const isCarried = !!carriedFrom[k];
                    return (
                      <div key={day.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-5 w-5 text-leaf-600" />
                          <div>
                            <p className="font-extrabold uppercase tracking-wide text-ink">{day.weekday}</p>
                          </div>
                          <Badge tone="green" className="ml-1">Open</Badge>
                        </div>
                        <div className="sm:w-72">
                          <p className="mb-1.5 text-xs text-ink-faint">
                            Menu changes can be made on {allowedDaysText} for the upcoming week.
                          </p>
                          <Select value={current} onChange={(e) => setDraftValue(s.id, day.key, e.target.value)}>
                            <option value="">Select Meal…</option>
                            {menu
                              .filter((m) => (m.days ?? []).includes(day.weekday))
                              .map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                          </Select>
                          {isCarried && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
                              <RotateCcw className="h-3 w-3" /> Carried from {carriedFrom[k]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={saveAll} size="lg" loading={saving}>
              <Save className="h-5 w-5" /> Save Selections
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
