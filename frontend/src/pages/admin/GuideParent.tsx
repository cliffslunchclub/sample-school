import { Printer } from "lucide-react";
import { APP_VERSION, GUIDE_UPDATED } from "../../lib/version";
import { useSemester } from "../../lib/SemesterContext";
import { orderingDayText } from "../../lib/semester";

export default function GuideParent() {
  const { orderingDays } = useSemester();
  const schoolAddress = window.location.host;
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
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Parent Guide</h1>
          <p className="mt-2 text-ink-soft">
            Everything you need to know to manage your child's school lunches — step by step.
          </p>
        </div>

        <p className="mb-6 text-xs text-ink-faint">Version {APP_VERSION} · Updated {GUIDE_UPDATED}</p>

        {/* Section 1 */}
        <Section number="1" title="Creating Your Account">
          <p className="mb-3 text-ink-soft">First time here? Here's how to get set up in under two minutes.</p>
          <Steps steps={[
            `Visit ${schoolAddress} in your browser.`,
            'Click "Create an account" on the login page.',
            "Enter your first name, last name, email address, a password of at least 8 characters, and the school verification code provided by your school.",
            'Click "Register" — you\'re in!',
            "Next time, just enter your email and password to log in.",
          ]} />
          <Note>If you ever forget your password, click "Forgot password" on the login page. Email delivery must be enabled for your school; contact the school if no reset email arrives.</Note>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="Viewing the Menu">
          <p className="mb-3 text-ink-soft">See what's being served before you make any selections.</p>
          <Steps steps={[
            'Click the "Menu" tab at the top of the page.',
            "Browse all available meals — organized by Monday through Friday.",
            "Each meal shows its name and a description.",
          ]} />
          <Note>The menu is set by the school. If you have questions about ingredients or allergens, please contact the school directly.</Note>
        </Section>

        {/* Section 3 */}
        <Section number="3" title="Adding Your Child">
          <p className="mb-3 text-ink-soft">Before selecting meals, add each of your children to your account.</p>
          <Steps steps={[
            'Click the "My Students" tab.',
            'Click the green "Add Student" button.',
            "Enter your child's full name.",
            "Select their grade from the dropdown.",
            "Select their teacher (the list updates based on the grade you picked).",
            'Click "Add student" to save.',
          ]} />
          <Note>Have more than one child at the school? Repeat these steps for each child — they'll all appear on your account and you can order for each of them separately.</Note>
        </Section>

        {/* Section 4 */}
        <Section number="4" title="Selecting Meals">
          <p className="mb-3 text-ink-soft">Choose what your child will eat each Monday through Friday.</p>
          <Steps steps={[
            'Click the "Meal Selection" tab.',
            "You'll see your children listed with dropdowns for Monday through Friday.",
            "Review the choices for each child and each day. Previous-week meals may be suggested; they still need to be saved. Only meals available on that weekday appear.",
            'Click "Save selections" to confirm your choices.',
          ]} />
          <Highlight title="When can I order?">
            Your school sets the days when meal selections can be changed. Check Meal Selection for the current schedule.
            During this time you can choose meals for the following Monday through Friday.
            The schedule uses Eastern time. Selecting no ordering days closes parent ordering. Outside the window, selections are locked.
            Current meal selection days: {orderingDayText(orderingDays)}.
          </Highlight>
          <Note>Changed your mind? You can update your selections as many times as you like while the window is open. Just come back and save again.</Note>
        </Section>

        {/* Section 5 */}
        <Section number="5" title="Viewing Your Orders">
          <p className="mb-3 text-ink-soft">Check what's been ordered for each of your children.</p>
          <Steps steps={[
            'Click the "My Orders" tab.',
            "You'll see all your confirmed meal selections, organized by Monday through Friday.",
            'Orders marked "Editable" can still be changed (the ordering window is open).',
            'Orders marked "Locked" cannot be changed here; contact the school for help.',
          ]} />
        </Section>

        {/* Section 6 */}
        <Section number="6" title="Managing Your Account">
          <Steps steps={[
            'Click the "Account" tab.',
            'Update your first and last name, then click "Save profile".',
            'To change your password, enter your current password, the new password and its confirmation, then click "Change password".',
            "Your email address is displayed here; contact your school if it needs to change.",
          ]} />
        </Section>

        <Note>Meal changes are recorded automatically for school administrators. Return to My Orders after saving to confirm the meals for each child.</Note>

        {/* Quick tips */}
        <div className="mt-8 rounded-xl bg-leaf-50 px-6 py-5">
          <p className="mb-3 font-extrabold text-leaf-800">Quick tips</p>
          <ul className="space-y-1.5 text-sm text-leaf-900">
            <li>• Review and save orders during the meal selection days shown by your school.</li>
            <li>• You can order for multiple children in one visit.</li>
            <li>• A blank choice does not create a new order or cancel an existing order. Contact the school to cancel a saved meal.</li>
            <li>• If you miss the window, contact the school office for help.</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-line pt-5 text-center text-xs text-ink-faint">
          Cliffs Lunch Club · {schoolAddress}
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

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border-l-4 border-leaf-400 bg-leaf-50/60 px-4 py-3 text-sm text-ink-soft">
      <strong className="font-bold text-leaf-700">Tip: </strong>{children}
    </div>
  );
}

function Highlight({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">
      <p className="mb-1 font-extrabold text-amber-800">{title}</p>
      <p>{children}</p>
    </div>
  );
}
