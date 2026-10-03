import { Printer } from "lucide-react";
import { APP_VERSION, GUIDE_UPDATED } from "../../lib/version";
import { useSemester } from "../../lib/SemesterContext";
import { orderingDayText } from "../../lib/semester";

export default function GuideAdmin() {
  const { orderingDays } = useSemester();
  return (
    <div className="mx-auto max-w-3xl py-4">

      {/* Print button */}
      <div className="mb-6 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-leaf-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-leaf-700"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Document */}
      <div className="rounded-2xl border border-line bg-white px-10 py-10 shadow-sm print:rounded-none print:border-0 print:shadow-none">

        {/* Header */}
        <div className="mb-8 border-b-2 border-leaf-600 pb-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-leaf-600">Cliffs Lunch Club</p>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Admin Guide</h1>
          <p className="mt-2 text-ink-soft">
            A complete reference for managing orders, students, menus, and more.
          </p>
        </div>

        <p className="mb-6 text-xs text-ink-faint">Version {APP_VERSION} · Updated {GUIDE_UPDATED}</p>

        {/* Section 1 */}
        <Section number="1" title="Dashboard">
          <p className="mb-3 text-sm text-ink-soft">
            The Dashboard gives you a snapshot of the program at a glance.
          </p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> <strong>Parents</strong> — total registered parent accounts.</li>
            <li><Dot /> <strong>Active students</strong> — students currently enrolled.</li>
            <li><Dot /> <strong>Active menu items</strong> — meals available to order.</li>
            <li><Dot /> <strong>Total orders</strong> — all meal selections across the semester.</li>
          </ul>
          <p className="text-sm text-ink-soft">Use the Quick Actions to jump straight to Orders, Order Summary, Import Data, or Students.</p>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="Orders">
          <p className="mb-3 text-sm text-ink-soft">View and manage every meal order in the system.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Use the search bar to find orders by student name, parent name, or meal.</li>
            <li><Dot /> Filter by <strong>day</strong> (Monday through Friday), delivery time, grade, teacher, or menu item.</li>
            <li><Dot /> Click the <strong>pencil icon</strong> on any row to change a student's meal or delivery time.</li>
            <li><Dot /> Click <strong>"New Order"</strong> to manually create an order for a student.</li>
            <li><Dot /> Click <strong>"Export CSV"</strong> to download the current filtered list.</li>
          </ul>
          <Note>The count at the top (e.g. "451 of 451 orders") updates as you filter — use this to quickly count orders for a specific group.</Note>
        </Section>

        {/* Section 3 */}
        <Section number="3" title="Order Summary">
          <p className="mb-3 text-sm text-ink-soft">See total meal counts broken down by delivery time — perfect for kitchen prep.</p>
          <Steps steps={[
            'Go to "Order Summary" in the sidebar.',
            "Choose any weekday from the dropdown.",
            "The table shows every menu item with a count per delivery time slot.",
            'Click "CSV" to download the summary, or "Print" to print it.',
          ]} />
          <Note>The totals cover the entire semester — not just one week. This is your full running count of what's been ordered.</Note>
        </Section>

        {/* Section 4 */}
        <Section number="4" title="Students">
          <p className="mb-3 text-sm text-ink-soft">Manage the full student roster.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Search by student name or filter by grade.</li>
            <li><Dot /> Click the <strong>edit icon</strong> to update a student's name, grade, teacher, or active status.</li>
            <li><Dot /> Click <strong>"Add student"</strong> to manually register a new student. A parent can be linked later when they sign up.</li>
            <li><Dot /> Deactivate students who have left — they'll be hidden from ordering but their history is preserved.</li>
          </ul>
        </Section>

        {/* Section 5 */}
        <Section number="5" title="Parents">
          <p className="mb-3 text-sm text-ink-soft">View all registered parent accounts and the students linked to them.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Search by name or email address.</li>
            <li><Dot /> See which children are associated with each parent account.</li>
            <li><Dot /> Parents self-register — you don't need to create accounts for them.</li>
          </ul>
        </Section>

        {/* Section 6 */}
        <Section number="6" title="Menu Items">
          <p className="mb-3 text-sm text-ink-soft">Control what meals are available to parents.</p>
          <Steps steps={[
            'Go to "Menu" in the sidebar.',
            'Click "Add item" to create a new meal.',
            "Enter the meal name, a short description, and which days it's served (any combination of Monday through Friday).",
            'Toggle a meal "Inactive" to hide it from parents without deleting it.',
          ]} />
          <p className="mb-3 text-sm text-ink-soft">To add or update several menu items at once:</p>
          <Steps steps={[
            'Choose "Download template" on the Menu page and fill in one row per item.',
            'Use Yes or No for each weekday. Active can be Yes or No; a blank Active cell defaults to Yes.',
            'Choose "Upload menu CSV" and review the preview. This menu upload is separate from student and order imports.',
            'New items are added. Existing name matches stay unchanged unless you choose "Update existing". Items omitted from the file are never changed or deleted.',
            'Click "Confirm menu upload" to save the reviewed changes.',
          ]} />
          <Note>Menu item names used by order imports should match the menu. Updating a menu item preserves its existing orders.</Note>
        </Section>

        {/* Section 7 */}
        <Section number="7" title="Grades & Teachers">
          <p className="mb-3 text-sm text-ink-soft">Set up the grade levels and teachers that students are assigned to.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Add grades (e.g. Kindergarten, Grade 1, Grade 2…) and set their display order.</li>
            <li><Dot /> Add teachers and link each to a grade.</li>
            <li><Dot /> Use the <strong>delete</strong> button to remove individual records, or <strong>"Purge all"</strong> to clear everything at once.</li>
          </ul>
          <Note>Deleting a grade or teacher that has students linked to it will be blocked. Reassign those students first.</Note>
        </Section>

        {/* Section 8 */}
        <Section number="8" title="Delivery Times">
          <p className="mb-3 text-sm text-ink-soft">Configure when lunches are delivered and which classes receive them.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Add delivery time slots (e.g. 10:45, 11:45) and set their order.</li>
            <li><Dot /> Set rules that link a grade/teacher to a specific delivery time — the system uses these to auto-assign times when orders are created.</li>
            <li><Dot /> Admins can always override the delivery time on any individual order.</li>
          </ul>
        </Section>

        {/* Section 9 */}
        <Section number="9" title="Importing Data">
          <p className="mb-3 text-sm text-ink-soft">Bulk-import student rosters and meal orders from a spreadsheet.</p>
          <Steps steps={[
            'Go to "Import Data" and click "Download template" to get the CSV format.',
            "Fill in your spreadsheet: Student Name, Grade, Teacher, Delivery Time, Monday Meal, Tuesday Meal, Wednesday Meal, Thursday Meal, Friday Meal.",
            "Leave any weekday meal blank to skip that day; existing orders are not cancelled by a blank cell.",
            'Save as a .csv file and click "Choose CSV file" to upload.',
            "Map your columns to the correct fields (the system usually detects them automatically).",
            'Click "Analyze data" to preview all rows before anything is saved.',
            "Resolve any conflicts (if a student already has an order, choose to overwrite or keep it).",
            'Click "Confirm Import" to save everything.',
          ]} />
          <Note>The system targets the next Monday on or after today within the configured semester, with Tuesday–Friday in that same week. On Monday, the import can target today; parent ordering targets the following week. Review the analysis and semester dates before confirming.</Note>
        </Section>

        {/* Section 10 */}
        <Section number="10" title="Settings">
          <p className="mb-3 text-sm text-ink-soft">Configure the semester and ordering window.</p>
          <ul className="mb-3 space-y-1 text-sm text-ink">
            <li><Dot /> Set the <strong>semester start and end dates</strong> — only dates within this range are available for ordering.</li>
            <li><Dot /> Choose <strong>Meal selection days</strong> — any days of the week when parents can make or change selections (default: Thursday and Friday). Save your settings. Selecting no days closes parent ordering.</li>
            <li><Dot /> Ordering uses Eastern time and targets the following week's Monday–Friday within the semester.</li>
            <li><Dot /> Current meal selection days: <strong>{orderingDayText(orderingDays)}</strong>.</li>
          </ul>
        </Section>

        {/* Section 11 */}
        <Section number="11" title="Admin Audit Logs">
          <p className="mb-3 text-sm text-ink-soft">
            Review recorded administrative changes — who changed what, and when.
            Useful for tracking manual edits or troubleshooting unexpected changes.
          </p>
        </Section>

        <Section number="12" title="Parent Audit Log">
          <p className="text-sm text-ink-soft">Use Parent Audit Log to review parent meal selections and changes. Entries are recorded automatically, including the parent, student, previous and new meals, delivery time changes, lunch date and timestamp. Entries cannot be edited or deleted through the app. Unchanged saves do not add entries. History starts when this feature is installed; seeded sample orders are not parent actions.</p>
        </Section>
        <Section number="13" title="Administrators">
          <p className="text-sm text-ink-soft">Open Administrators and choose Create admin. Enter the staff member's name, email, a password of at least 12 characters and its confirmation, then choose Create account. The new admin belongs to this school. Share the login directly; the new account uses Admin Login.</p>
        </Section>

        {/* Footer */}
        <div className="mt-10 border-t border-line pt-5 text-center text-xs text-ink-faint">
          Cliffs Lunch Club · Admin Guide
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 break-inside-avoid">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-sm font-extrabold text-white">
          {number}
        </div>
        <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      </div>
      <div className="pl-11">{children}</div>
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mb-4 space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-ink">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf-100 text-xs font-extrabold text-leaf-700">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Dot() {
  return <span className="mr-1 inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-leaf-500" />;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-l-4 border-leaf-400 bg-leaf-50/60 px-4 py-3 text-sm text-ink-soft">
      <strong className="font-bold text-leaf-700">Note: </strong>{children}
    </div>
  );
}
