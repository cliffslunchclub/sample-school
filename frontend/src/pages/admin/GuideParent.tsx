import { Printer } from "lucide-react";

export default function GuideParent() {
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

        {/* Section 1 */}
        <Section number="1" title="Creating Your Account">
          <p className="mb-3 text-ink-soft">First time here? Here's how to get set up in under two minutes.</p>
          <Steps steps={[
            "Visit chs.cliffslunchclub.com in your browser.",
            'Click "Create an account" on the login page.',
            "Enter your first name, last name, email address, and a password.",
            'Click "Register" — you\'re in!',
            "Next time, just enter your email and password to log in.",
          ]} />
          <Note>If you ever forget your password, click "Forgot password" on the login page and we'll send a reset link to your email.</Note>
        </Section>

        {/* Section 2 */}
        <Section number="2" title="Viewing the Menu">
          <p className="mb-3 text-ink-soft">See what's being served before you make any selections.</p>
          <Steps steps={[
            'Click the "Menu" tab at the top of the page.',
            "Browse all available meals — organized by Monday and Wednesday.",
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
          <p className="mb-3 text-ink-soft">Choose what your child will eat each Monday and Wednesday.</p>
          <Steps steps={[
            'Click the "Meal Selection" tab.',
            "You'll see your children listed with dropdowns for Monday and Wednesday.",
            "Pick a meal for each day from the menu options.",
            'Click "Save selections" to confirm your choices.',
          ]} />
          <Highlight title="When can I order?">
            The ordering window opens every <strong>Thursday</strong> and closes at the end of <strong>Friday</strong>.
            During this time you can choose meals for the following Monday and Wednesday.
            Outside this window, selections are locked.
          </Highlight>
          <Note>Changed your mind? You can update your selections as many times as you like while the window is open. Just come back and save again.</Note>
        </Section>

        {/* Section 5 */}
        <Section number="5" title="Viewing Your Orders">
          <p className="mb-3 text-ink-soft">Check what's been ordered for each of your children.</p>
          <Steps steps={[
            'Click the "My Orders" tab.',
            "You'll see all your confirmed meal selections, organized by Monday and Wednesday.",
            'Orders marked "Editable" can still be changed (the ordering window is open).',
            'Orders marked "Locked" are confirmed and will be delivered.',
          ]} />
        </Section>

        {/* Section 6 */}
        <Section number="6" title="Managing Your Account">
          <Steps steps={[
            'Click the "Account" tab.',
            "Update your first name, last name, email, or password.",
            'Click "Save changes" when done.',
          ]} />
        </Section>

        {/* Quick tips */}
        <div className="mt-8 rounded-xl bg-leaf-50 px-6 py-5">
          <p className="mb-3 font-extrabold text-leaf-800">Quick tips</p>
          <ul className="space-y-1.5 text-sm text-leaf-900">
            <li>• Order every Thursday or Friday — the window closes at the weekend.</li>
            <li>• You can order for multiple children in one visit.</li>
            <li>• Leaving a day blank means no lunch is ordered for that day.</li>
            <li>• If you miss the window, contact the school office for help.</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-line pt-5 text-center text-xs text-ink-faint">
          Cliffs Lunch Club · chs.cliffslunchclub.com
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
